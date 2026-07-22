import {z} from 'zod'
import {validatePhoneNumber, validateName} from '@/utils/validators'

export const registerSchema = z.object({
  name: z.string().trim().refine(validateName, 'auth/invalid-name'),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().refine(validatePhoneNumber, 'auth/invalid-phone-number'),
  password: z.string().min(6, 'auth/weak-password')
})
