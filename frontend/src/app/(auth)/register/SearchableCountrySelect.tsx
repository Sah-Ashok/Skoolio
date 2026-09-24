'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import styles from './register.module.css';

export const ALL_COUNTRIES: string[] = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'East Timor',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
  'Other',
];

interface SearchableCountrySelectProps {
  value: string;
  onChange: (country: string) => void;
  disabled?: boolean;
}

export default function SearchableCountrySelect({
  value,
  onChange,
  disabled = false,
}: SearchableCountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter countries alphabetically
  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [search]);

  // Group by first letter for letter-wise display when not searching
  const groupedCountries = useMemo(() => {
    if (search.trim()) return null;
    const groups: Record<string, string[]> = {};
    for (const country of ALL_COUNTRIES) {
      const letter = country === 'Other' ? '#' : country[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(country);
    }
    return groups;
  }, [search]);

  const handleSelect = (country: string) => {
    onChange(country);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={styles.searchSelectWrap} ref={containerRef}>
      {/* Trigger Box */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${styles.searchSelectTrigger} ${isOpen ? styles.open : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <i className={`fa-solid fa-globe ${styles.searchSelectTriggerIcon}`} />
        <span>{value || 'Select Country'}</span>
        <i className={`fa-solid fa-chevron-down ${styles.searchSelectArrow} ${isOpen ? styles.rotated : ''}`} />
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className={styles.searchSelectDropdown} role="listbox">
          {/* Search Header */}
          <div className={styles.searchSelectHeader}>
            <div className={styles.searchSelectInputWrap}>
              <i className="fa-solid fa-magnifying-glass" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className={styles.searchSelectSearchInput}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false);
                  if (e.key === 'Enter' && filteredCountries.length > 0) {
                    e.preventDefault();
                    handleSelect(filteredCountries[0]);
                  }
                }}
              />
              {search && (
                <button
                  type="button"
                  className={styles.searchSelectClearBtn}
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {/* Country List */}
          <div className={styles.searchSelectList}>
            {filteredCountries.length === 0 ? (
              <div className={styles.searchSelectEmpty}>
                No country found matching &ldquo;{search}&rdquo;
              </div>
            ) : groupedCountries ? (
              // Letter-wise Grouped View
              Object.entries(groupedCountries).map(([letter, countries]) => (
                <div key={letter}>
                  <div className={styles.searchSelectLetterGroup}>{letter}</div>
                  {countries.map((c) => {
                    const isSelected = c === value;
                    return (
                      <div
                        key={c}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(c)}
                        className={`${styles.searchSelectItem} ${isSelected ? styles.active : ''}`}
                      >
                        <span>{c}</span>
                        {isSelected && <i className="fa-solid fa-check" />}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              // Flat Search Results View
              filteredCountries.map((c) => {
                const isSelected = c === value;
                return (
                  <div
                    key={c}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(c)}
                    className={`${styles.searchSelectItem} ${isSelected ? styles.active : ''}`}
                  >
                    <span>{c}</span>
                    {isSelected && <i className="fa-solid fa-check" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
