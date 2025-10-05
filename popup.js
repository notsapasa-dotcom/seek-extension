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
  const output = document.getElementById('jobTitle');
  
  if (jobData.title) {
    output.innerHTML = `
      <strong>Job ID:</strong> ${jobData.id || 'Not found'}<br>
      <strong>Title:</strong> ${jobData.title}<br>
      <strong>Location:</strong> ${jobData.location || 'Not found'}<br>
      <strong>Salary:</strong> ${jobData.salary || 'Not listed'}
    `;
  } else {
    output.textContent = 'Not on a Seek job page';
  }
})();

// This function runs on the Seek page itself
function extractJobData() {
  const titleElement = document.querySelector('[data-automation="job-detail-title"]');
  const locationElement = document.querySelector('[data-automation="job-detail-location"]');
  const salaryElement = document.querySelector('[data-automation="job-detail-salary"]');
  
  // Extract job ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  
  // Get title text
  let title = null;
  if (titleElement) {
    const link = titleElement.querySelector('a');
    title = link ? link.textContent.trim() : titleElement.textContent.trim();
  }
  
  return {
    id: jobId,
    title: title,
    location: locationElement ? locationElement.textContent.trim() : null,
    salary: salaryElement ? salaryElement.textContent.trim() : null
  };
}