import express, { Request, Response } from 'express'
import { drizzle } from 'drizzle-orm/vercel-postgres'
import { migrate } from 'drizzle-orm/vercel-postgres/migrator'
import { sql } from '@vercel/postgres'
import {  z } from 'zod'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const db = drizzle(sql, { schema: {users} })
const start = Date.now()
migrate(db, { migrationsFolder: "drizzle" })
  .then(() => console.log('success migration'))
  .catch(err => console.log(`failed migration err: `, err))
  .finally(() => console.log(`finish in ${start - Date.now()}s`))

const findUserByEmail = (email: string) => db.query.users.findFirst({
  where: eq(users.email, email)
})

const jwtKey = process.env.JWT_KEY || 'somekey'

async function register(req: Request, res: Response) {
  const regex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])")
  const msg = 'at least contain 1 lowercase, 1 uppercase, and 1 number'
  
  const zodSchema = z.object({
    nama: z.string().trim().min(1),
    email: z.string().email(),
    password: z.string().min(8).max(16).regex(regex, msg),
  })

  const result = zodSchema.safeParse(req.body)
  if(!result.success) {
    return res.status(400)
      .json(result.error.format())
  }

  const exist = await findUserByEmail(result.data.email)
    .catch(error => res.status(500).json({ error }));

  if(exist) {
    return res.status(400)
      .json({
        email: {
          _errors: ['email telah digunakan oleh user lain']
        }
      })
  }
  
  const salt = await bcrypt.genSalt()
  const hashed = await bcrypt.hash(result.data.password, salt)

  const [inserted] = await db.insert(users).values({
    nama: result.data.nama,
    email: result.data.email,
    password: hashed
  }).returning()

  res.status(201)
    .json({
      id: inserted.id,
      nama: inserted.nama,
      email: inserted.email,
    })  
}

async function login(req: Request, res: Response) {
  
  const zodSchema = z.object({
    email: z.string().min(1).email(),
    password: z.string().min(1),
  })

  const result = zodSchema.safeParse(req.body)
  if(!result.success) {
    return res.status(400).json(result.error.format())
  }

  const exist = await findUserByEmail(result.data.email)
  if(!exist) {
    return res.status(400)
      .json({ 
        email: {
          _errors: ['email / password tidak sesuai']
        } 
      })
  }

  const valid = await bcrypt.compare(result.data.password, exist.password || '')
  if(!valid) {
    return res.status(400)
      .json({ 
        email: {
          _errors: ['email / password tidak sesuai']
        } 
      })
  }
  
  exist.password = null
  const token = jwt.sign(exist, jwtKey)
  
  
  res.status(200)
    .json({token})

}

function me(req: Request, res: Response) {
  // get token
  
  const auth = req.headers['authorization'] // Bearer <TOKEN>
  if(!auth) {
    return res.sendStatus(401)
  }

  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, jwtKey) as {nama: string; email: string; id: number}
    res.status(200)
      .json(payload)
  } catch(error) {
    res.sendStatus(401)
  }  
}


const app = express()

app.use(express.json())
app.post('/api/register', register)
app.post('/api/login', login)
app.get('/api/me', me)

export default app






// new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})");
