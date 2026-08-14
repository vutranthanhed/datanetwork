// Main Application Logic

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Update button states
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update panel visibility
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load appropriate data
        if (tabName === 'available') {
            loadAvailableRequests();
        } else if (tabName === 'my-requests') {
            loadMyRequests();
        } else if (tabName === 'my-claims') {
            loadMyClaims();
        }
    });
});

// New Request Button
document.getElementById('new-request-btn').addEventListener('click', () => {
    showModal('new-request-modal');
});

// Handle New Request Form
document.getElementById('new-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        alert("Please login first!");
        return;
    }
    
    const errorDiv = document.getElementById('request-error');
    
    const title = document.getElementById('request-title').value;
    const category = document.getElementById('request-category').value;
    const description = document.getElementById('request-description').value;
    const instructions = document.getElementById('request-instructions').value;
    const pointsOffered = parseInt(document.getElementById('request-points').value);
    const requiredResponses = parseInt(document.getElementById('request-responses').value);
    const deadlineInput = document.getElementById('request-deadline').value;
    
    // Calculate total cost
    const totalCost = pointsOffered * requiredResponses;
    
    try {
        // Check user has enough balance
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userBalance = userDoc.data().balance;
        
        if (userBalance < totalCost) {
            errorDiv.textContent = `Insufficient balance! You need ${totalCost} points but only have ${userBalance} points.`;
            errorDiv.style.display = 'block';
            return;
        }
        
        // Create request document
        const requestData = {
            requesterId: currentUser.uid,
            requesterEmail: currentUser.email,
            title: title,
            category: category,
            description: description,
            instructions: instructions,
            pointsOffered: pointsOffered,
            requiredResponses: requiredResponses,
            currentClaims: 0,
            status: 'open',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            verificationMethod: 'manual_review'
        };
        
        // Add deadline if provided
        if (deadlineInput) {
            requestData.deadline = new Date(deadlineInput);
        }
        
        // Save request to Firestore
        await db.collection('requests').add(requestData);
        
        // Deduct points from user balance
        await db.collection('users').doc(currentUser.uid).update({
            balance: firebase.firestore.FieldValue.increment(-totalCost),
            requestsMade: firebase.firestore.FieldValue.increment(1)
        });
        
        console.log("Request created successfully!");
        
        // Close modal and reset form
        closeModal('new-request-modal');
        document.getElementById('new-request-form').reset();
        
        // Reload user data and requests
        loadUserData();
        loadMyRequests();
        
    } catch (error) {
        console.error("Error creating request:", error);
        errorDiv.textContent = "Failed to create request. Please try again.";
        errorDiv.style.display = 'block';
    }
});

// Load Available Requests (for claiming)
async function loadAvailableRequests() {
    const container = document.getElementById('available-requests');
    container.innerHTML = '<p class="loading">Loading requests...</p>';
    
    try {
        const snapshot = await db.collection('requests')
            .where('status', '==', 'open')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="loading">No requests available yet. Check back soon!</p>';
            return;
        }
        
        container.innerHTML = '';
        
        snapshot.forEach(doc => {
            const request = doc.data();
            const requestId = doc.id;
            
            // Don't show user's own requests
            if (currentUser && request.requesterId === currentUser.uid) {
                return;
            }
            
            const card = createRequestCard(request, requestId, 'claim');
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error("Error loading requests:", error);
        container.innerHTML = '<p class="loading">Error loading requests. Please refresh.</p>';
    }
}

// Load My Requests (that I posted)
async function loadMyRequests() {
    if (!currentUser) return;
    
    const container = document.getElementById('my-requests-list');
    container.innerHTML = '<p class="loading">Loading your requests...</p>';
    
    try {
        const snapshot = await db.collection('requests')
            .where('requesterId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="loading">You haven\'t created any requests yet.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        snapshot.forEach(doc => {
            const request = doc.data();
            const requestId = doc.id;
            
            const card = createRequestCard(request, requestId, 'manage');
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error("Error loading my requests:", error);
        container.innerHTML = '<p class="loading">Error loading your requests. Please refresh.</p>';
    }
}

// Load My Claims (requests I'm fulfilling)
async function loadMyClaims() {
    if (!currentUser) return;
    
    const container = document.getElementById('my-claims-list');
    container.innerHTML = '<p class="loading">Loading your claims...</p>';
    
    try {
        const snapshot = await db.collection('claims')
            .where('claimerId', '==', currentUser.uid)
            .orderBy('submittedAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="loading">You haven\'t claimed any requests yet.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        // For each claim, fetch the corresponding request details
        for (const doc of snapshot.docs) {
            const claim = doc.data();
            const claimId = doc.id;
            
            const requestDoc = await db.collection('requests').doc(claim.requestId).get();
            if (requestDoc.exists) {
                const request = requestDoc.data();
                const card = createClaimCard(claim, claimId, request);
                container.appendChild(card);
            }
        }
        
    } catch (error) {
        console.error("Error loading claims:", error);
        container.innerHTML = '<p class="loading">Error loading your claims. Please refresh.</p>';
    }
}

// Create Request Card HTML
function createRequestCard(request, requestId, type) {
    const card = document.createElement('div');
    card.className = 'request-card';
    
    const progress = `${request.currentClaims} / ${request.requiredResponses}`;
    const isComplete = request.currentClaims >= request.requiredResponses;
    
    card.innerHTML = `
        <div class="request-header">
            <div>
                <h3 class="request-title">${escapeHtml(request.title)}</h3>
                <span class="request-category">${request.category}</span>
            </div>
        </div>
        <p class="request-description">${escapeHtml(request.description)}</p>
        <div class="request-footer">
            <span class="points-offer">${request.pointsOffered} pts</span>
            <span class="progress-text">${progress} responses</span>
        </div>
        ${type === 'claim' && !isComplete ? 
            `<button class="btn btn-primary btn-block" onclick="claimRequest('${requestId}')">Claim This Request</button>` : 
            ''
        }
        ${type === 'manage' ? 
            `<button class="btn btn-secondary btn-block" onclick="viewClaims('${requestId}')">View Claims (${request.currentClaims})</button>` : 
            ''
        }
    `;
    
    return card;
}

// Create Claim Card HTML
function createClaimCard(claim, claimId, request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    
    const statusColors = {
        'pending': '#ff9800',
        'approved': '#4caf50',
        'rejected': '#f44336',
        'disputed': '#9c27b0'
    };
    
    card.innerHTML = `
        <div class="request-header">
            <div>
                <h3 class="request-title">${escapeHtml(request.title)}</h3>
                <span class="request-category" style="background: ${statusColors[claim.status]}; color: white;">
                    ${claim.status.toUpperCase()}
                </span>
            </div>
        </div>
        <p class="request-description"><strong>Your submission:</strong> ${escapeHtml(claim.submittedData || 'Processing...')}</p>
        <div class="request-footer">
            <span class="points-offer">${claim.pointsAwarded} pts</span>
            <span class="progress-text">Submitted: ${formatDate(claim.submittedAt)}</span>
        </div>
    `;
    
    return card;
}

// Claim a Request
async function claimRequest(requestId) {
    if (!currentUser) {
        alert("Please login first!");
        return;
    }
    
    const submission = prompt("Enter your data/confirmation code:");
    if (!submission || submission.trim() === '') {
        return;
    }
    
    try {
        // Get request details
        const requestDoc = await db.collection('requests').doc(requestId).get();
        const request = requestDoc.data();
        
        // Check if already claimed by this user
        const existingClaim = await db.collection('claims')
            .where('requestId', '==', requestId)
            .where('claimerId', '==', currentUser.uid)
            .get();
        
        if (!existingClaim.empty) {
            alert("You've already claimed this request!");
            return;
        }
        
        // Create claim document
        await db.collection('claims').add({
            requestId: requestId,
            claimerId: currentUser.uid,
            claimerEmail: currentUser.email,
            requesterId: request.requesterId,
            pointsAwarded: request.pointsOffered,
            status: 'pending',
            submittedData: submission.trim(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update request claim count
        await db.collection('requests').doc(requestId).update({
            currentClaims: firebase.firestore.FieldValue.increment(1)
        });
        
        alert("Claim submitted! Waiting for requester approval.");
        loadAvailableRequests();
        
    } catch (error) {
        console.error("Error claiming request:", error);
        alert("Failed to submit claim. Please try again.");
    }
}

// View Claims for a Request (placeholder for Phase 4)
function viewClaims(requestId) {
    alert(`View claims feature coming in Phase 4! Request ID: ${requestId}`);
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Format Date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
}

// Initialize: Load requests when dashboard first opens
if (currentUser) {
    loadAvailableRequests();
}