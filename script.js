/*
    WebChat
    Static WebRTC chat

    No server/database is required.

    The only network connection is WebRTC.

    To connect two users:

    USER A:
        Create Connection Code
        ↓
        Give code to USER B

    USER B:
        Paste code
        ↓
        Generate Response
        ↓
        Give response to USER A

    USER A:
        Paste response
        ↓
        Connect
*/


// ============================================================
// STORAGE
// ============================================================

const USER_KEY = "webchat_username";
const MESSAGES_KEY = "webchat_messages";

let username = localStorage.getItem(USER_KEY);

let currentChannel = "general";

let messages = JSON.parse(
    localStorage.getItem(MESSAGES_KEY) || "{}"
);

if (!messages.general) messages.general = [];
if (!messages.random) messages.random = [];
if (!messages.gaming) messages.gaming = [];


// ============================================================
// DOM
// ============================================================

const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");

const usernameInput = document.getElementById("usernameInput");
const loginButton = document.getElementById("loginButton");

const currentUsername = document.getElementById("currentUsername");
const userAvatar = document.getElementById("userAvatar");

const logoutButton = document.getElementById("logoutButton");

const messagesElement = document.getElementById("messages");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const channelName = document.getElementById("channelName");

const userList = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");

const connectionButton =
    document.getElementById("connectionButton");

const connectionModal =
    document.getElementById("connectionModal");

const closeModal =
    document.getElementById("closeModal");

const connectionStatus =
    document.getElementById("connectionStatus");

const webrtcStatus =
    document.getElementById("webrtcStatus");


// ============================================================
// LOGIN
// ============================================================

function enterChat() {

    let name = usernameInput.value.trim();

    if (!name) {
        usernameInput.focus();
        return;
    }

    name = name.replace(/\s+/g, "_");

    username = name;

    localStorage.setItem(USER_KEY, username);

    showApp();
}


function showApp() {

    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");

    currentUsername.textContent = username;

    userAvatar.textContent =
        username.charAt(0).toUpperCase();

    updateUsers();

    renderMessages();

    messageInput.placeholder =
        `Message #${currentChannel}`;

    messageInput.focus();
}


loginButton.addEventListener("click", enterChat);

usernameInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        enterChat();
    }

});


logoutButton.addEventListener("click", () => {

    localStorage.removeItem(USER_KEY);

    location.reload();

});


if (username) {
    showApp();
}


// ============================================================
// CHANNELS
// ============================================================

document.querySelectorAll(".channel").forEach(button => {

    button.addEventListener("click", () => {

        document
            .querySelectorAll(".channel")
            .forEach(b => b.classList.remove("active"));

        button.classList.add("active");

        currentChannel =
            button.dataset.channel;

        channelName.textContent =
            "# " + currentChannel;

        messageInput.placeholder =
            `Message #${currentChannel}`;

        renderMessages();

    });

});


// ============================================================
// MESSAGE STORAGE
// ============================================================

function saveMessages() {

    localStorage.setItem(
        MESSAGES_KEY,
        JSON.stringify(messages)
    );

}


// ============================================================
// MESSAGE SENDING
// ============================================================

messageForm.addEventListener("submit", event => {

    event.preventDefault();

    const text = messageInput.value.trim();

    if (!text) return;

    sendMessage({
        type: "message",

        id:
            crypto.randomUUID(),

        author: username,

        channel: currentChannel,

        text: text,

        timestamp: Date.now()
    });

    messageInput.value = "";

    hideMentionSuggestions();

});


function sendMessage(data) {

    // Display locally
    handleIncomingMessage(data);

    // Send to peer
    if (
        dataChannel &&
        dataChannel.readyState === "open"
    ) {

        dataChannel.send(
            JSON.stringify(data)
        );

    }

}


// ============================================================
// RECEIVE MESSAGE
// ============================================================

function handleIncomingMessage(data) {

    if (data.type === "message") {

        if (!messages[data.channel]) {
            messages[data.channel] = [];
        }

        // Avoid duplicates
        if (
            messages[data.channel]
                .some(message => message.id === data.id)
        ) {
            return;
        }

        messages[data.channel].push(data);

        saveMessages();

        if (data.channel === currentChannel) {
            renderMessages();
        }

        updateUsers();

    }


    if (data.type === "delete") {

        for (const channel in messages) {

            messages[channel] =
                messages[channel].filter(
                    m => m.id !== data.id
                );

        }

        saveMessages();

        renderMessages();

    }


    if (data.type === "edit") {

        for (const channel in messages) {

            const message =
                messages[channel]
                    .find(m => m.id === data.id);

            if (message) {
                message.text = data.text;
                message.edited = true;
            }

        }

        saveMessages();

        renderMessages();

    }

}


// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages() {

    messagesElement.innerHTML = "";

    const channelMessages =
        messages[currentChannel] || [];

    if (channelMessages.length === 0) {

        messagesElement.innerHTML = `
            <div class="welcome">
                <div class="welcomeIcon">#</div>
                <h1>Welcome to #${escapeHTML(currentChannel)}</h1>
                <p>
                    This is the beginning of this channel.
                </p>
            </div>
        `;

        return;
    }


    channelMessages.forEach(message => {

        const element =
            document.createElement("div");

        element.className = "message";

        const isOwn =
            message.author === username;


        element.innerHTML = `
            <div class="messageAvatar">
                ${escapeHTML(
                    message.author.charAt(0).toUpperCase()
                )}
            </div>

            <div class="messageContent">

                <div class="messageHeader">

                    <span class="messageAuthor">
                        ${escapeHTML(message.author)}
                    </span>

                    <span class="messageTime">
                        ${formatTime(message.timestamp)}
                        ${message.edited ? " (edited)" : ""}
                    </span>

                </div>

                <div class="messageText">
                    ${formatMessage(message.text)}
                </div>

            </div>

            ${
                isOwn
                ?
                `
                <div class="messageActions">

                    <button
                        onclick="editMessage('${message.id}')"
                        title="Edit"
                    >
                        ✎
                    </button>

                    <button
                        onclick="deleteMessage('${message.id}')"
                        title="Delete"
                    >
                        🗑
                    </button>

                </div>
                `
                :
                ""
            }
        `;

        messagesElement.appendChild(element);

    });


    messagesElement.scrollTop =
        messagesElement.scrollHeight;

}


// ============================================================
// MESSAGE FORMATTING
// ============================================================

function formatMessage(text) {

    let escaped = escapeHTML(text);

    /*
        Convert @username into a mention.

        This works for usernames such as:

        @Alex
        @Player_123
        @somebody
    */

    escaped = escaped.replace(
        /@([a-zA-Z0-9_]+)/g,

        `<span class="mention">@$1</span>`
    );

    return escaped;
}


function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


function formatTime(timestamp) {

    return new Date(timestamp)
        .toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });

}


// ============================================================
// EDIT
// ============================================================

window.editMessage = function(id) {

    const channelMessages =
        messages[currentChannel];

    const message =
        channelMessages.find(
            m => m.id === id
        );

    if (!message) return;

    const newText =
        prompt("Edit your message:", message.text);

    if (
        newText === null ||
        !newText.trim()
    ) {
        return;
    }

    sendMessage({
        type: "edit",
        id: id,
        text: newText.trim()
    });

};


// ============================================================
// DELETE
// ============================================================

window.deleteMessage = function(id) {

    if (!confirm("Delete this message?")) {
        return;
    }

    sendMessage({
        type: "delete",
        id: id
    });

};


// ============================================================
// USERS
// ============================================================

let connectedUsers = new Set();

function updateUsers() {

    connectedUsers.add(username);

    userList.innerHTML = "";

    connectedUsers.forEach(name => {

        const row =
            document.createElement("div");

        row.className = "userRow";

        row.innerHTML = `
            <div class="avatar">
                ${escapeHTML(
                    name.charAt(0).toUpperCase()
                )}
            </div>

            <div class="userRowName">
                ${escapeHTML(name)}
            </div>

            <div class="onlineDot"></div>
        `;

        userList.appendChild(row);

    });

    onlineCount.textContent =
        connectedUsers.size;

}


// ============================================================
// MENTION SUGGESTIONS
// ============================================================

const mentionSuggestions =
    document.getElementById("mentionSuggestions");


messageInput.addEventListener("input", () => {

    const value = messageInput.value;

    const cursor =
        messageInput.selectionStart;

    const beforeCursor =
        value.substring(0, cursor);

    const match =
        beforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (!match) {

        hideMentionSuggestions();

        return;
    }

    const search =
        match[1].toLowerCase();

    const users =
        [...connectedUsers]
            .filter(user =>
                user.toLowerCase().startsWith(search)
            );

    if (!users.length) {

        hideMentionSuggestions();

        return;
    }

    mentionSuggestions.innerHTML = "";

    users.forEach(user => {

        const button =
            document.createElement("button");

        button.className =
            "mentionSuggestion";

        button.textContent =
            "@" + user;

        button.addEventListener("click", () => {

            const start =
                cursor - match[0].length;

            messageInput.value =
                value.substring(0, start) +
                "@" + user + " " +
                value.substring(cursor);

            messageInput.focus();

            hideMentionSuggestions();

        });

        mentionSuggestions.appendChild(button);

    });

    mentionSuggestions.classList.remove("hidden");

});


function hideMentionSuggestions() {

    mentionSuggestions.classList.add("hidden");

}


// ============================================================
// WEBRTC
// ============================================================

let peerConnection = null;
let dataChannel = null;


/*
    Google's public STUN server.

    STUN does NOT relay your chat messages.

    It helps WebRTC figure out how two browsers
    can connect to each other.
*/

const rtcConfiguration = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]

};


// ============================================================
// CREATE PEER
// ============================================================

function createPeer() {

    peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );


    peerConnection.onicecandidate =
        event => {

            /*
                We wait until ICE gathering is finished.

                Then the complete SDP can be copied.
            */

            if (
                event.candidate === null
            ) {

                updateWebRTCStatus(
                    "Connection code ready."
                );

                const description =
                    peerConnection.localDescription;

                if (description) {

                    const encoded =
                        encodeConnectionData(
                            description
                        );

                    document.getElementById(
                        "offerOutput"
                    ).value = encoded;

                }

            }

        };


    peerConnection.onconnectionstatechange =
        () => {

            const state =
                peerConnection.connectionState;

            if (state === "connected") {

                updateWebRTCStatus(
                    "Connected!"
                );

                connectionStatus.textContent =
                    "Connected";

            }
            else {

                updateWebRTCStatus(
                    "Connection: " + state
                );

            }

        };


    peerConnection.ondatachannel =
        event => {

            dataChannel =
                event.channel;

            setupDataChannel();

        };

}


// ============================================================
// DATA CHANNEL
// ============================================================

function setupDataChannel() {

    if (!dataChannel) return;

    dataChannel.onopen = () => {

        updateWebRTCStatus(
            "Connected!"
        );

        connectionStatus.textContent =
            "Connected";

        /*
            Tell the other browser who we are.
        */

        dataChannel.send(
            JSON.stringify({
                type: "user",
                username: username
            })
        );

    };


    dataChannel.onclose = () => {

        updateWebRTCStatus(
            "Connection closed."
        );

        connectionStatus.textContent =
            "Disconnected";

    };


    dataChannel.onerror = error => {

        console.error(
            "WebRTC error:",
            error
        );

    };


    dataChannel.onmessage =
        event => {

            try {

                const data =
                    JSON.parse(event.data);

                if (data.type === "user") {

                    connectedUsers.add(
                        data.username
                    );

                    updateUsers();

                    /*
                        Send our username back.
                    */

                    if (
                        dataChannel.readyState ===
                        "open"
                    ) {

                        dataChannel.send(
                            JSON.stringify({
                                type: "user",
                                username: username
                            })
                        );

                    }

                    return;
                }

                handleIncomingMessage(data);

            }
            catch (error) {

                console.error(
                    "Invalid WebRTC message:",
                    error
                );

            }

        };

}


// ============================================================
// ENCODE / DECODE
// ============================================================

function encodeConnectionData(data) {

    const json =
        JSON.stringify(data);

    return btoa(
        encodeURIComponent(json)
    );

}


function decodeConnectionData(data) {

    const json =
        decodeURIComponent(
            atob(data.trim())
        );

    return JSON.parse(json);

}


// ============================================================
// CREATE OFFER
// ============================================================

document.getElementById(
    "createOfferButton"
).addEventListener("click", async () => {

    createPeer();

    dataChannel =
        peerConnection.createDataChannel(
            "chat"
        );

    setupDataChannel();


    const offer =
        await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
        offer
    );

    updateWebRTCStatus(
        "Gathering connection information..."
    );

});


// ============================================================
// CREATE ANSWER
// ============================================================

document.getElementById(
    "createAnswerButton"
).addEventListener("click", async () => {

    const input =
        document.getElementById(
            "offerInput"
        ).value.trim();

    if (!input) {

        alert(
            "Paste a connection code first."
        );

        return;
    }


    try {

        const offer =
            decodeConnectionData(input);

        createPeer();

        await peerConnection.setRemoteDescription(
            offer
        );


        const answer =
            await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(
            answer
        );


        updateWebRTCStatus(
            "Generating response..."
        );

    }
    catch (error) {

        console.error(error);

        alert(
            "That connection code is invalid."
        );

    }

});


// ============================================================
// FINISH CONNECTION
// ============================================================

document.getElementById(
    "finishConnectionButton"
).addEventListener("click", async () => {

    const input =
        document.getElementById(
            "answerInput"
        ).value.trim();

    if (!input) {

        alert(
            "Paste the response first."
        );

        return;
    }


    if (!peerConnection) {

        alert(
            "Create a connection first."
        );

        return;
    }


    try {

        const answer =
            decodeConnectionData(input);

        await peerConnection.setRemoteDescription(
            answer
        );

        updateWebRTCStatus(
            "Connecting..."
        );

    }
    catch (error) {

        console.error(error);

        alert(
            "That response is invalid."
        );

    }

});


// ============================================================
// COPY BUTTONS
// ============================================================

document.getElementById(
    "copyOfferButton"
).addEventListener("click", () => {

    copyText(
        document.getElementById(
            "offerOutput"
        ).value
    );

});


document.getElementById(
    "copyAnswerButton"
).addEventListener("click", () => {

    copyText(
        document.getElementById(
            "answerOutput"
        ).value
    );

});


async function copyText(text) {

    if (!text) return;

    try {

        await navigator.clipboard.writeText(
            text
        );

    }
    catch {

        alert(
            "Copy failed. Select the text manually."
        );

    }

}


// ============================================================
// CONNECTION MODAL
// ============================================================

connectionButton.addEventListener(
    "click",
    () => {

        connectionModal.classList.remove(
            "hidden"
        );

    }
);


closeModal.addEventListener(
    "click",
    () => {

        connectionModal.classList.add(
            "hidden"
        );

    }
);


connectionModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            connectionModal
        ) {

            connectionModal.classList.add(
                "hidden"
            );

        }

    }
);


// ============================================================
// STATUS
// ============================================================

function updateWebRTCStatus(text) {

    webrtcStatus.textContent =
        text;

}


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

messageInput.addEventListener(
    "keydown",
    event => {

        /*
            Enter sends the message.

            Shift + Enter creates a newline.
        */

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            messageForm.requestSubmit();

        }

    }
);
