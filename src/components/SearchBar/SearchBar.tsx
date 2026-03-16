import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSearch }) => {
  const { t } = useLanguage()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-wrapper">
        <svg 
          className="search-icon" 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder={t.search.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-accent">
        {t.search.button}
      </button>
    </form>
  )
}
