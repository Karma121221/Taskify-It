const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 
                (process.env.NODE_ENV === 'production' 
                  ? 'https://taskify-it.onrender.com'  // Your actual Render URL
                  : 'http://localhost:5000')
};

export default config;