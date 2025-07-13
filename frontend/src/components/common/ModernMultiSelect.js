// src/components/common/ModernMultiSelect.jsx

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, XCircle } from 'lucide-react'; // Import icons
// import Loader from './Loader'; // Removed Loader import as it's no longer used

const ModernMultiSelect = ({
    label,
    name,
    options, // Array of { value, label, subLabel }
    selectedValues, // Array of currently selected values
    onChange, // Callback: (newSelectedValues) => void
    placeholder = "Select...",
    required = false,
    disabled = false // This prop is key for the loading state
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleToggle = () => {
        if (!disabled) { // Only toggle if not disabled
            setIsOpen(prev => !prev);
        }
    };

    const handleCheckboxChange = (value) => {
        const newSelectedValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newSelectedValues);
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            onChange(options.map(option => option.value));
        } else {
            onChange([]);
        }
    };

    const handleRemoveTag = (valueToRemove) => {
        onChange(selectedValues.filter(v => v !== valueToRemove));
    };

    const isAllSelected = options.length > 0 && selectedValues.length === options.length &&
                            options.every(option => selectedValues.includes(option.value));

    const selectedOptionObjects = selectedValues
        .map(value => options.find(option => option.value === value))
        .filter(Boolean); // Filter out any values that don't correspond to an option

    return (
        <div className="relative mb-4" ref={selectRef}>
            {label && (
                <label htmlFor={name} className="block text-gray-700 text-sm font-bold mb-2">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            
            <div
                className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight cursor-pointer flex items-center justify-between min-h-[42px] ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                onClick={handleToggle}
            >
                <div className="flex flex-wrap gap-1">
                    {selectedOptionObjects.length > 0 ? (
                        selectedOptionObjects.map((option) => (
                            <span key={option.value} className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {option.label}
                                {!disabled && ( // Only show remove button if not disabled
                                    <XCircle
                                        size={12}
                                        className="ml-1 cursor-pointer hover:text-blue-900"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(option.value); }}
                                    />
                                )}
                            </span>
                        ))
                    ) : (
                        <span className="text-gray-500">{placeholder}</span>
                    )}
                </div>
                {!disabled && (isOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />)}
            </div>

            {/* Removed the loading overlay entirely */}
            {/* {disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md z-20">
                    <Loader size={16} />
                    <span className="ml-2 text-blue-600 text-xs">Loading...</span>
                </div>
            )}
            */}

            {isOpen && !disabled && ( // Only show dropdown content if not disabled and isOpen
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-gray-200">
                        <label className="inline-flex items-center text-gray-800 cursor-pointer">
                            <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                checked={isAllSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            <span className="ml-2 font-medium">Select All</span>
                        </label>
                    </div>
                    {options.map(option => (
                        <div key={option.value} className="p-2 hover:bg-gray-100 cursor-pointer">
                            <label className="inline-flex items-center text-gray-700 cursor-pointer w-full">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                    value={option.value}
                                    checked={selectedValues.includes(option.value)}
                                    onChange={() => handleCheckboxChange(option.value)}
                                />
                                <span className="ml-2">{option.label}</span>
                                {option.subLabel && <span className="text-gray-500 text-sm ml-2">({option.subLabel})</span>}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModernMultiSelect;