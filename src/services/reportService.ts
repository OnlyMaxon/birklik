import { db } from '../config/firebase'
import { CommentReport, ReportReason } from '../types'
import * as logger from './logger'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore'

const REPORTS_COLLECTION = 'commentReports'

/**
 * Create a report for a comment
 * @param {string} propertyId - Property ID
 * @param {string} commentId - Comment ID to report
 * @param {string} commentText - Text of the reported comment
 * @param {string} reportedBy - ID of user making the report
 * @param {string} reportedByName - Name of user making the report
 * @param {ReportReason} reason - Reason for the report
 * @param {string} details - Additional details about the report
 * @returns {Promise<CommentReport|null>} Created report object, or null if duplicate
 */
export const createCommentReport = async (
  propertyId: string,
  commentId: string,
  commentText: string,
  reportedBy: string,
  reportedByName: string,
  reason: ReportReason,
  details?: string
): Promise<CommentReport | null> => {
  try {
    // Check if user already reported this comment (prevent duplicates)
    const existingReports = await getCommentReports(commentId)
    if (existingReports.some(r => r.reportedBy === reportedBy)) {
      logger.warn(`User ${reportedBy} already reported comment ${commentId}`)
      return null
    }

    const reportData = {
      propertyId,
      commentId,
      commentText,
      reportedBy,
      reportedByName,
      reason,
      details: details || '',
      createdAt: new Date().toISOString(),
      status: 'open',
      commentDeleted: false
    }

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData)
    
    return {
      id: docRef.id,
      ...reportData
    } as CommentReport
  } catch (error) {
    logger.error('Error creating comment report:', error)
    throw error
  }
}

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
 * Get reports for a specific property
 * @param {string} propertyId - Property ID
 * @returns {Promise<CommentReport[]>} Array of reports for property
 */
export const getPropertyReports = async (propertyId: string): Promise<CommentReport[]> => {
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('propertyId', '==', propertyId),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as CommentReport))
  } catch (error) {
    logger.error('Error fetching property reports:', error)
    throw error
  }
}

/**
 * Get open reports for a specific comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<CommentReport[]>} Array of open reports for comment
 */
export const getCommentReports = async (commentId: string): Promise<CommentReport[]> => {
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('commentId', '==', commentId),
      where('status', '==', 'open')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as CommentReport))
  } catch (error) {
    logger.error('Error fetching comment reports:', error)
    throw error
  }
}

/**
 * Update report status (mark as closed or comment as deleted)
 * @param {string} reportId - Report ID
 * @param {Partial<CommentReport>} updates - Fields to update
 * @returns {Promise<boolean>} True on success
 */
export const updateReport = async (
  reportId: string,
  updates: Partial<CommentReport>
): Promise<boolean> => {
  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId)
    await updateDoc(reportRef, updates)
    return true
  } catch (error) {
    logger.error('Error updating report:', error)
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

/**
 * Delete a report
 * @param {string} reportId - Report ID to delete
 * @returns {Promise<boolean>} True on success
 */
export const deleteReport = async (reportId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, REPORTS_COLLECTION, reportId))
    return true
  } catch (error) {
    logger.error('Error deleting report:', error)
    throw error
  }
}

/**
 * Get all reports by status
 * @param {string} status - Report status ('open' or 'closed')
 * @returns {Promise<CommentReport[]>} Array of reports with given status
 */
export const getReportsByStatus = async (status: 'open' | 'closed'): Promise<CommentReport[]> => {
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as CommentReport))
  } catch (error) {
    logger.error('Error fetching reports by status:', error)
    throw error
  }
}
