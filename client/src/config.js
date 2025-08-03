const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 
                (process.env.NODE_ENV === 'production' 
                  ? 'https://taskify-it-api.onrender.com'
                  : 'http://localhost:5000')
};

export default config;