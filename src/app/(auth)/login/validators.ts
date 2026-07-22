import {z} from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1)
})

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email()
})
