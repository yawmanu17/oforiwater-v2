import { showError } from '../ui/toast.js';

export function getErrorMessage(error, fallback = 'Something went wrong.') {
    if (!error) return fallback;

    if (typeof error === 'string') return error;

    if (error.message) return error.message;

    if (error.error_description) return error.error_description;

    if (error.details) return error.details;

    return fallback;
}

export function handleUiError(error, fallback = 'Something went wrong.') {
    console.error(error);
    showError(getErrorMessage(error, fallback));
}