import {z} from 'zod'
import {validatePhoneNumber, validateName} from '@birklik/core/utils/validators'

// Только те поля, что пишем в Firestore сами. Почту и пароль проверяет Firebase
// при создании учётки в браузере и возвращает свои коды ошибок.
export const profileSchema = z.object({
  name: z.string().trim().refine(validateName, 'auth/invalid-name'),
  phone: z.string().trim().refine(validatePhoneNumber, 'auth/invalid-phone-number')
})
