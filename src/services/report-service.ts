import { db } from '../lib/firebase/client'
import { CommentReport } from '@birklik/core/types'
import * as logger from './logger'
import { collection, query, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore'

const REPORTS_COLLECTION = 'commentReports'

/**
 * Get all reports for moderation
 * @returns {Promise<CommentReport[]>} Array of all reports
 */
export const getAllReports = async (): Promise<CommentReport[]> => {
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as CommentReport))
  } catch (error) {
    logger.error('Error fetching all reports:', error)
    throw error
  }
}

/**
 * Close a report (when action has been taken)
 * @param {string} reportId - Report ID
 * @param {boolean} commentDeleted - Whether the comment was deleted
 * @returns {Promise<boolean>} True on success
 */
export const closeReport = async (
  reportId: string,
  commentDeleted: boolean = false
): Promise<boolean> => {
  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId)
    await updateDoc(reportRef, {
      status: 'closed',
      commentDeleted
    })
    return true
  } catch (error) {
    logger.error('Error closing report:', error)
    throw error
  }
}

