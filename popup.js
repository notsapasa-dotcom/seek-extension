let currentJob = null;

// Utility to show/hide forms
function showForm(form) {
  document.getElementById('seekForm').style.display = form === 'seek' ? '' : 'none';
  document.getElementById('linkedinForm').style.display = form === 'linkedin' ? '' : 'none';
  document.getElementById('indeedForm').style.display = form === 'indeed' ? '' : 'none';
}

// Run automatically when popup opens
(async () => {
  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';

  if (url.startsWith('https://www.seek.com.au/')) {
    showForm('seek');
    // Execute script on the page to extract job data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobData
    });
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
    downloadBtn.onclick = () => {
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
  a.download = `seek-${currentJob.id || 'unknown'}.json`;
      a.click();
      // Cleanup
      URL.revokeObjectURL(url);
    };
  } else if (url.startsWith('https://www.linkedin.com/')) {
    showForm('linkedin');
    // Extract LinkedIn job data (title and description)
    // Extract LinkedIn job ID from URL
    let linkedinJobId = null;
    try {
      const urlObj = new URL(url);
      linkedinJobId = urlObj.searchParams.get('currentJobId');
    } catch (e) {}

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function extractLinkedinJobData() {
        const title = document.querySelector('h1')?.innerText || null;
        const description = document.querySelector('#job-details > div > p')?.innerText || null;
        return { title, description };
      }
    });
    const jobData = results[0].result;
    jobData.linkedinJobId = linkedinJobId;
    let display = jobData.title ? `<br><strong>Title:</strong> ${jobData.title}` : 'Not on a LinkedIn job page';
    if (jobData.linkedinJobId) {
      display += `<br><strong>Job ID:</strong> ${jobData.linkedinJobId}`;
    }
    if (jobData.description) {
      display += `<br><strong>Description:</strong> ${jobData.description.split(' ').slice(0, 10).join(' ')}...`;
    }
    document.getElementById('linkedinJobTitle').innerHTML = display;
    document.getElementById('downloadLinkedinJob').onclick = () => {
      const jobWithTimestamp = {
        ...jobData,
        savedAt: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(jobWithTimestamp, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
  a.download = `linkedin-${jobData.linkedinJobId || 'unknown'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  } else if (url.startsWith('https://au.indeed.com/')) {
    showForm('indeed');
    // Extract Indeed job ID from vjk param
    let indeedJobId = null;
    try {
      const urlObj = new URL(url);
      indeedJobId = urlObj.searchParams.get('vjk');
    } catch (e) {}

    // Extract job title and description (basic selectors, can be improved)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function extractIndeedJobData() {
        const title = document.querySelector('h1')?.innerText || null;
        // Try to get description from a common Indeed selector
        const description = document.querySelector('#jobDescriptionText')?.innerText || null;
        return { title, description };
      }
    });
    const jobData = results[0].result;
    jobData.indeedJobId = indeedJobId;
    let display = jobData.title ? `<br><strong>Title:</strong> ${jobData.title}` : 'Not on an Indeed job page';
    if (jobData.indeedJobId) {
      display += `<br><strong>Job ID:</strong> ${jobData.indeedJobId}`;
    }
    if (jobData.description) {
      display += `<br><strong>Description:</strong> ${jobData.description.split(' ').slice(0, 10).join(' ')}...`;
    }
    document.getElementById('indeedJobTitle').innerHTML = display;
    document.getElementById('downloadIndeedJob').onclick = () => {
      const jobWithTimestamp = {
        ...jobData,
        savedAt: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(jobWithTimestamp, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indeed-${jobData.indeedJobId || 'unknown'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  } else {
    showForm('seek'); // fallback: show Seek form with message
    document.getElementById('jobTitle').textContent = 'Not on a supported job site.';
    document.getElementById('downloadJob').disabled = true;
  }
})();


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