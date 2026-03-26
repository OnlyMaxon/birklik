import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSearch }) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState('')
  const [checkOut, setCheckOut] = React.useState('')
  const [guests, setGuests] = React.useState('2')

  const isEnglish = language === 'en'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-grid">
        <div className="search-field search-field-destination">
          <label>{isEnglish ? 'Where to?' : 'Hara?'}</label>
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
        </div>

        <div className="search-field">
          <label>{isEnglish ? 'Check-in' : 'Giriş tarixi'}</label>
          <input
            type="date"
            className="search-input"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>

        <div className="search-field">
          <label>{isEnglish ? 'Check-out' : 'Çıxış tarixi'}</label>
          <input
            type="date"
            className="search-input"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>

        <div className="search-field">
          <label>{isEnglish ? 'Guests' : 'Qonaq sayı'}</label>
          <select
            className="search-input"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5+</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-accent search-submit-btn">
        {t.search.button}
      </button>
    </form>
  )
}
