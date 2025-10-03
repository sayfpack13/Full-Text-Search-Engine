import toast from 'react-hot-toast';

export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  const errorData = error.response?.data?.error;
  
  if (!errorData) {
    toast.error(defaultMessage);
    return;
  }

  switch (errorData.type) {
    case 'validation':
      toast.error(errorData.message);
      break;
      
    case 'authentication':
      if (errorData.code === 'TOKEN_EXPIRED') {
        toast.error('Your session has expired. Please log in again.');
        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        toast.error(errorData.message);
      }
      break;
      
    case 'authorization':
      toast.error('You do not have permission to perform this action.');
      break;
      
    case 'service_unavailable':
      if (errorData.code === 'RUST_BINARY_NOT_FOUND') {
        toast.error('Search engine is not available. Please contact administrator.');
      } else if (errorData.code === 'BINARY_NOT_FOUND') {
        toast.error('Search engine is not available. Please contact administrator.');
      } else {
        toast.error('Service is temporarily unavailable. Please try again later.');
      }
      break;
      
    case 'search_engine':
      toast.error('Search engine error. Please try again.');
      break;
      
    case 'not_found':
      toast.error('The requested resource was not found.');
      break;
      
    case 'internal':
      if (process.env.NODE_ENV === 'development') {
        toast.error(`Internal error: ${errorData.message}`);
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
      break;
      
    default:
      toast.error(errorData.message || defaultMessage);
  }
};

export const getErrorMessage = (error) => {
  const errorData = error.response?.data?.error;
  return errorData?.message || 'An error occurred';
};

export const isServiceUnavailable = (error) => {
  const errorData = error.response?.data?.error;
  return errorData?.type === 'service_unavailable';
};

export const isValidationError = (error) => {
  const errorData = error.response?.data?.error;
  return errorData?.type === 'validation';
};

export const isAuthenticationError = (error) => {
  const errorData = error.response?.data?.error;
  return errorData?.type === 'authentication';
};
