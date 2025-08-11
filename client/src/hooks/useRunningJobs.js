import { useState, useEffect } from 'react';
import axios from 'axios';

// Simple hook to check if there are any running jobs
export const useRunningJobs = (enabled = true) => {
  const [hasRunningJobs, setHasRunningJobs] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // This is a simplified implementation
    // In a real app, you'd track job IDs and poll them
    const checkForRunningJobs = () => {
      // For now, we'll just check if there's a stored jobId in sessionStorage
      const currentJobId = sessionStorage.getItem('currentJobId');
      setHasRunningJobs(!!currentJobId);
    };

    checkForRunningJobs();
    
    // Check every 5 seconds
    const interval = setInterval(checkForRunningJobs, 5000);
    
    return () => clearInterval(interval);
  }, [enabled]);

  return hasRunningJobs;
};

export default useRunningJobs;
