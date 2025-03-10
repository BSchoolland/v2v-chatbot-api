/**
 * Utility functions for date manipulation, especially useful for testing
 */

// Store the offset in milliseconds
let dateOffset = 0;

/**
 * Get the current date, adjusted by any offset in development mode
 * @returns {Date} The current date, possibly adjusted by an offset
 */
function getCurrentDate() {
    const realDate = new Date();
    
    // In development mode, apply the offset
    if (process.env.ENV === 'development' && dateOffset !== 0) {
        return new Date(realDate.getTime() + dateOffset);
    }
    
    return realDate;
}

/**
 * Set a date offset for testing in development mode
 * @param {number} days - Number of days to offset (positive for future, negative for past)
 * @param {number} hours - Number of hours to offset (positive for future, negative for past)
 * @param {number} minutes - Number of minutes to offset (positive for future, negative for past)
 * @returns {Object} The current offset information
 */
function setDateOffset(days = 0, hours = 0, minutes = 0) {
    if (process.env.ENV !== 'development') {
        console.warn('Date offset can only be set in development mode');
        return { success: false, message: 'Date offset can only be set in development mode' };
    }
    
    // Calculate total offset in milliseconds
    const daysMs = days * 24 * 60 * 60 * 1000;
    const hoursMs = hours * 60 * 60 * 1000;
    const minutesMs = minutes * 60 * 1000;
    
    dateOffset = daysMs + hoursMs + minutesMs;
    
    const now = getCurrentDate();
    
    return {
        success: true,
        offset: {
            days,
            hours,
            minutes,
            totalMilliseconds: dateOffset
        },
        currentAdjustedDate: now.toISOString()
    };
}

/**
 * Reset any date offset
 * @returns {Object} Success status
 */
function resetDateOffset() {
    dateOffset = 0;
    return { 
        success: true, 
        message: 'Date offset reset',
        currentDate: new Date().toISOString()
    };
}

/**
 * Get the current date offset information
 * @returns {Object} The current offset information
 */
function getDateOffsetInfo() {
    const offsetDays = Math.floor(dateOffset / (24 * 60 * 60 * 1000));
    const remainingMs = dateOffset % (24 * 60 * 60 * 1000);
    const offsetHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMs2 = remainingMs % (60 * 60 * 1000);
    const offsetMinutes = Math.floor(remainingMs2 / (60 * 1000));
    
    return {
        offset: {
            days: offsetDays,
            hours: offsetHours,
            minutes: offsetMinutes,
            totalMilliseconds: dateOffset
        },
        currentAdjustedDate: getCurrentDate().toISOString(),
        currentRealDate: new Date().toISOString(),
        isDevelopmentMode: process.env.ENV === 'development'
    };
}

module.exports = {
    getCurrentDate,
    setDateOffset,
    resetDateOffset,
    getDateOffsetInfo
}; 