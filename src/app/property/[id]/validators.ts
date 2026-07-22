import {z} from 'zod'

export const propertyIdSchema = z.string().trim().min(1).max(128)
export type PropertyIdInput = z.infer<typeof propertyIdSchema>

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const bookingSchema = z.object({
  propertyId: propertyIdSchema,
  checkInDate: isoDateSchema,
  checkOutDate: isoDateSchema
}).refine(data => data.checkOutDate > data.checkInDate, {message: 'checkOutDate must be after checkInDate'})

export const commentSchema = z.object({
  propertyId: propertyIdSchema,
  text: z.string().trim().min(1).max(2000)
})

export const replySchema = z.object({
  propertyId: propertyIdSchema,
  parentCommentId: z.string().trim().min(1),
  text: z.string().trim().min(1).max(2000)
})

export const ratingSchema = z.object({
  propertyId: propertyIdSchema,
  rating: z.number().int().min(1).max(5)
})

export const reportCommentSchema = z.object({
  propertyId: propertyIdSchema,
  commentId: z.string().trim().min(1),
  commentText: z.string().trim().min(1),
  reason: z.enum(['spam', 'inappropriate', 'offensive', 'misleading', 'other']),
  details: z.string().trim().max(500).optional()
})
