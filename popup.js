let currentJob = null;

// Run automatically when popup opens
(async () => {
  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Execute script on the page to extract job data
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractJobData
  });
  
  // Display the result
  const jobData = results[0].result;
  currentJob = jobData;
  
  const output = document.getElementById('jobTitle');
  const downloadBtn = document.getElementById('downloadJob');
  
  if (jobData.title) {
    // Get first 10 words of description
    const descPreview = jobData.description 
      ? jobData.description.split(' ').slice(0, 10).join(' ') + '...'
      : 'Not found';
    
    output.innerHTML = `
      <strong>Job ID:</strong> ${jobData.id || 'Not found'}<br>
      <strong>Title:</strong> ${jobData.title}<br>
      <strong>Location:</strong> ${jobData.location || 'Not found'}<br>
      <strong>Salary:</strong> ${jobData.salary || 'Not listed'}<br>
      <strong>Description:</strong> ${descPreview}
    `;
  } else {
    output.textContent = 'Not on a Seek job page';
    downloadBtn.disabled = true;
  }
})();

// Download button handler
document.getElementById('downloadJob').addEventListener('click', () => {
  if (!currentJob) return;
  
  // Add timestamp
  const jobWithTimestamp = {
    ...currentJob,
    savedAt: new Date().toISOString()
  };
  
  // Create JSON string
  const jsonStr = JSON.stringify(jobWithTimestamp, null, 2);
  
  // Create blob and download
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create temporary link and click it
  const a = document.createElement('a');
  a.href = url;
  a.download = `seek-job-${currentJob.id || 'unknown'}.json`;
  a.click();
  
  // Cleanup
  URL.revokeObjectURL(url);
});

// This function runs on the Seek page itself
function extractJobData() {
  const titleElement = document.querySelector('[data-automation="job-detail-title"]');
  const locationElement = document.querySelector('[data-automation="job-detail-location"]');
  const salaryElement = document.querySelector('[data-automation="job-detail-salary"]');
  const descriptionElement = document.querySelector('[data-automation="jobAdDetails"]');
  const advertiserElement = document.querySelector('[data-automation="advertiser-name"]');
  // Extract job ID from URL - check both formats
  const urlParams = new URLSearchParams(window.location.search);
  let jobId = urlParams.get('jobId'); // Format 1: ?jobId=87447074
  
  // If not found in query params, check path format
  if (!jobId) {
    const pathMatch = window.location.pathname.match(/\/job\/(\d+)/); // Format 2: /job/87447074
    if (pathMatch) {
      jobId = pathMatch[1];
    }
  }
  
  // Get current page URL
  const currentUrl = window.location.href;
  
  // Get title text and job URL
  let title = null;
  let jobUrl = null;
  if (titleElement) {
    const link = titleElement.querySelector('a');
    if (link) {
      title = link.textContent.trim();
      // Get the href and convert to full URL if it's relative
      const href = link.getAttribute('href');
      if (href) {
        jobUrl = href.startsWith('http') ? href : `https://www.seek.com.au${href}`;
      }
    } else {
      title = titleElement.textContent.trim();
    }
  }
  
  // Get description text (full text for JSON export)
  let description = null;
  if (descriptionElement) {
    description = descriptionElement.textContent.trim();
  }
  
  // Get advertiser name
  let advertiser = null;
  if (advertiserElement) {
    advertiser = advertiserElement.textContent.trim();
  }
  
  return {
    id: jobId,
    title: title,
    location: locationElement ? locationElement.textContent.trim() : null,
    salary: salaryElement ? salaryElement.textContent.trim() : null,
    description: description,
    advertiser: advertiser,
    jobUrl: jobUrl,
    searchUrl: currentUrl
  };
}