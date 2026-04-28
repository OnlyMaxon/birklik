/**
 * Sanitization utilities for preventing XSS attacks
 */

/**
 * Sanitize user input by removing potentially dangerous HTML/scripts
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input safe for display
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return ''
  
  // Create a temporary element to leverage browser's HTML parsing
  const temp = document.createElement('div')
  temp.textContent = input
  return temp.innerHTML
}

/**
 * Sanitize and decode HTML entities
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export const sanitizeHtml = (html: string): string => {
  if (!html || typeof html !== 'string') return ''
  
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  
  return html.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Allow only safe HTML tags
 * @param {string} html - HTML string to filter
 * @returns {string} Filtered HTML with only safe tags
 */
export const allowSafeHtml = (html: string): string => {
  if (!html || typeof html !== 'string') return ''
  
  // Create a div to parse HTML
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // Allowed safe tags
  const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li']
  
  // Recursively clean elements
  const cleanNode = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      if (!allowedTags.includes(tagName)) {
        // Replace element with its text content
        const text = document.createTextNode(element.textContent || '')
        element.replaceWith(text)
      } else if (tagName === 'a') {
        // Remove dangerous attributes from links
        element.removeAttribute('onclick')
        element.removeAttribute('onerror')
        const href = element.getAttribute('href')
        if (href && !href.startsWith('http')) {
          element.removeAttribute('href')
        }
      } else {
        // Remove all attributes except href for links
        Array.from(element.attributes).forEach((attr) => {
          if (tagName !== 'a' || attr.name !== 'href') {
            element.removeAttribute(attr.name)
          }
        })
      }
      
      // Process children
      Array.from(element.childNodes).forEach(cleanNode)
    }
  }
  
  cleanNode(temp)
  return temp.innerHTML
}

/**
 * Remove all HTML tags
 * @param {string} html - HTML string to strip
 * @returns {string} Plain text
 */
export const stripHtml = (html: string): string => {
  if (!html || typeof html !== 'string') return ''
  
  const temp = document.createElement('div')
  temp.innerHTML = html
  return temp.textContent || temp.innerText || ''
}
