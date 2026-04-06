/**
 * STUDENT INFO ACCESS RESEARCH APP
 * Architecture: Finite State Machine & Async Data Buffer
 */

// ==========================================
// 1. DOM ELEMENTS & SYSTEM STATE
// ==========================================
const form = document.getElementById('research-form');
const steps = Array.from(document.querySelectorAll('.form-step'));
const progressBar = document.getElementById('progress-bar');
const nextBtn = document.getElementById('next-btn');
const prevBtn = document.getElementById('prev-btn');
const submitBtn = document.getElementById('submit-btn');

let currentStep = 1;
const totalSteps = steps.length;

// YOUR EXCEL API WEBHOOK GOES HERE (Power Automate or App Script URL)
const SUBMIT_URL = 'https://script.google.com/macros/s/AKfycbwqTkTOBY-Jotn0zkZuTkWVLeRwCyvdBaLsSyG_eedYzWqf8Mt2SR6rbjE9_zPFfWL2/exec'; 

// ==========================================
// 2. STATE MANAGEMENT (The UI Logic)
// ==========================================
function updateUI() {
  // Update Steps Visibility
  steps.forEach(step => {
    step.classList.remove('active');
    if (parseInt(step.dataset.step) === currentStep) {
      step.classList.add('active');
    }
  });

  // Update Progress Bar
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
  progressBar.style.width = progressPercentage + '%';

  // Update Button States
  prevBtn.disabled = currentStep === 1;

  if (currentStep === totalSteps) {
    nextBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    submitBtn.classList.add('hidden');
  }
}

// ==========================================
// 3. DATA VALIDATION (Preventing GIGO)
// ==========================================
function validateCurrentStep() {
  const currentSection = document.querySelector(`.form-step[data-step="${currentStep}"]`);
  const inputs = Array.from(currentSection.querySelectorAll('input, textarea'));
  
  // If the section has no inputs (rare, but safe), let them pass
  if (inputs.length === 0) return true;

  // Check if at least one radio is checked OR a text field has content
  let isValid = false;
  inputs.forEach(input => {
    if (input.type === 'radio' && input.checked) isValid = true;
    if ((input.type === 'text' || input.tagName.toLowerCase() === 'textarea') && input.value.trim() !== '') isValid = true;
  });

  if (!isValid) {
    alert("System Check: Please select or enter an answer before proceeding.");
  }
  
  return isValid;
}

// ==========================================
// 4. EVENT LISTENERS (Navigation)
// ==========================================
nextBtn.addEventListener('click', () => {
  if (validateCurrentStep()) {
    currentStep++;
    updateUI();
  }
});

prevBtn.addEventListener('click', () => {
  if (currentStep > 1) {
    currentStep--;
    updateUI();
  }
});

// Initialize UI on load
updateUI();

// ==========================================
// 5. THE DATA PIPELINE & OFFLINE ENGINE
// ==========================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Final validation catch
  if (!validateCurrentStep()) return;

  // Package Data via FormData API
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  
  // Generate a Unique Response ID (Timestamp + Random String)
  payload.response_id = "R-" + Date.now().toString(36).toUpperCase(); 
  // Add a unique timestamp for your Excel analysis
  payload.timestamp = new Date().toISOString();
  // Send to Queue Manager
  await handleDataSubmission(payload);
  
  // Reset System for Next Student (Zero Latency)
  form.reset();
  currentStep = 1;
  updateUI();
});


async function handleDataSubmission(payload) {
  submitBtn.innerText = "Sending...";
  submitBtn.disabled = true;

  if (navigator.onLine) {
    try {
      // Convert JSON to URL-encoded string
      const searchParams = new URLSearchParams(payload);

      await fetch(SUBMIT_URL, {
        method: 'POST',
        mode: 'no-cors', // <--- This tells the browser to stop worrying about the response
        body: searchParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log("Data sent (opaque mode). Check your sheet!");
      // Since mode is 'no-cors', we won't 'see' the success message, 
      // but the data will still land in Google Sheets.
    } catch (error) {
      saveToBuffer(payload);
    }
  } else {
    saveToBuffer(payload);
  }

  submitBtn.innerText = "Submit Data";
  submitBtn.disabled = false;
}

function saveToBuffer(data) {
  const buffer = JSON.parse(localStorage.getItem('researchOutbox') || "[]");
  buffer.push(data);
  localStorage.setItem('researchOutbox', JSON.stringify(buffer));
  alert("No connection detected. Data saved to local buffer.");
}

// Global Listener for Connection Restoration
window.addEventListener('online', async () => {
  const buffer = JSON.parse(localStorage.getItem('researchOutbox') || "[]");
  if (buffer.length > 0) {
    console.log(`Connection restored. Flushing ${buffer.length} records to Excel...`);
    
    // Process queue
    for (const item of buffer) {
      try {
        await fetch(SUBMIT_URL, {
          method: 'POST',
          body: JSON.stringify(item),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        console.error("Sync failed for an item, will try again later.");
        return; // Break loop if still failing
      }
    }
    
    // Clear buffer only if loop completes successfully
    localStorage.removeItem('researchOutbox');
    alert("Back Online! Buffer flushed successfully.");
  }
});

const syncBtn = document.getElementById('sync-btn');

// Show the button ONLY if there is data in the buffer
function checkBuffer() {
  const buffer = JSON.parse(localStorage.getItem('researchOutbox') || "[]");
  if (buffer.length > 0) {
    syncBtn.classList.remove('hidden');
    syncBtn.innerText = `Sync ${buffer.length} Pending Responses`;
  } else {
    syncBtn.classList.add('hidden');
  }
}

syncBtn.addEventListener('click', async () => {
  if (!navigator.onLine) {
    alert("Still offline. Find a signal first!");
    return;
  }
  // Trigger the same sync logic we wrote earlier
  window.dispatchEvent(new Event('online'));
});

// Run this check every time the page loads
checkBuffer();

console.log("DEBUG PAYLOAD:", payload);