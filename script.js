import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================
//
// Replace this with YOUR Firebase config.
//
// Firebase Console:
// Project settings → Your apps → Web app
//

const firebaseConfig = {
  apiKey: "AIzaSyDazblQCORsSx2FKp5ZdAFFG0iZl0D8IFM",
  authDomain: "webchat-e4ee2.firebaseapp.com",
  databaseURL: "https://webchat-e4ee2-default-rtdb.firebaseio.com",
  projectId: "webchat-e4ee2",
  storageBucket: "webchat-e4ee2.firebasestorage.app",
  messagingSenderId: "239562636281",
  appId: "1:239562636281:web:1d97f1d91bf7428dfb9b28"
};


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const db =
    getFirestore(app);

const storage =
    getStorage(app);


// ============================================================
// SETTINGS
// ============================================================

const MAX_MESSAGES = 500;

const ADMIN_INTERNAL_NAME =
    "Rom67i⭐";

const ADMIN_DISPLAY_NAME =
    "Rom67i";

const USERNAME_KEY =
    "webchat_username";

const ROOM_KEY =
    "webchat_room";

const BANNED_WORDS = [
    "fuck","shit","bitch","asshole","damn","crap","bastard",
    "dick","pussy","cock","cunt","slut","whore","nigger","nigga",
    "faggot","retard","porn","xxx","nsfw"
];


// ============================================================
// STATE
// ============================================================

let currentUser = null;

let profile = null;

let currentChannel = "general";

let currentRoom =
    localStorage.getItem(ROOM_KEY) || "main";

let unsubscribeMessages = null;

let unsubscribeUsers = null;

let unsubscribeRoom = null;

let users = new Map();

let currentAdmin = false;

let selectedMessage = null;

let messageCache = [];

let pendingImageFile = null;
let pendingImageDataUrl = null;


// ============================================================
// DOM
// ============================================================

const $ = id =>
    document.getElementById(id);

const loginScreen =
    $("loginScreen");

const appElement =
    $("app");

const usernameInput =
    $("usernameInput");

const loginButton =
    $("loginButton");

const loginError =
    $("loginError");

const myUsername =
    $("myUsername");

const myRole =
    $("myRole");

const myAvatar =
    $("myAvatar");

const channelList =
    $("channelList");

const channelTitle =
    $("channelTitle");

const connectionStatus =
    $("connectionStatus");

const messagesElement =
    $("messages");

const attachButton =
    $("attachButton");

const imageInput =
    $("imageInput");

const imagePreview =
    $("imagePreview");

const messageForm =
    $("messageForm");

const messageInput =
    $("messageInput");

const mentionSuggestions =
    $("mentionSuggestions");

const userList =
    $("userList");

const onlineCount =
    $("onlineCount");

const roomModal =
    $("roomModal");

const settingsModal =
    $("settingsModal");

const roomCode =
    $("roomCode");

const roomInput =
    $("roomInput");


// ============================================================
// AUTHENTICATION
// ============================================================

signInAnonymously(auth)
    .catch(error => {

        console.error(error);

        loginError.textContent =
            "Firebase authentication failed.";

    });


onAuthStateChanged(
    auth,
    async user => {

        if (!user) return;

        currentUser = user;

        connectionStatus.textContent =
            "Connected to Firebase";

        await initializeUser();

    }
);


// ============================================================
// INITIALIZE USER
// ============================================================

async function initializeUser() {

    const storedName =
        localStorage.getItem(USERNAME_KEY);

    if (storedName) {

        await loginWithUsername(
            storedName
        );

    }

}


// ============================================================
// USERNAME LOGIN
// ============================================================

loginButton.addEventListener(
    "click",
    async () => {

        await loginWithUsername(
            usernameInput.value
        );

    }
);


usernameInput.addEventListener(
    "keydown",
    async event => {

        if (event.key === "Enter") {

            await loginWithUsername(
                usernameInput.value
            );

        }

    }
);


async function loginWithUsername(name) {

    if (!currentUser) {

        loginError.textContent =
            "Connecting to Firebase...";

        return;

    }

    name =
        name
            .trim()
            .replace(/\s+/g, "_");


    if (!name) {

        loginError.textContent =
            "Enter a username.";

        return;

    }


    if (name.length < 2) {

        loginError.textContent =
            "Username must be at least 2 characters.";

        return;

    }


    if (name.length > 24) {

        loginError.textContent =
            "Username is too long.";

        return;

    }


    try {

        const userRef =
            doc(
                db,
                "users",
                currentUser.uid
            );


        const existing =
            await getDoc(userRef);


        let internalName = name;


        /*
            The admin identity is stored internally
            with the hidden star.

            The UI only displays "Rom67i".
        */

        if (
            name === ADMIN_DISPLAY_NAME
        ) {

            internalName =
                ADMIN_INTERNAL_NAME;

        }


        await setDoc(
            userRef,
            {
                username: internalName,

                displayName:
                    internalName ===
                    ADMIN_INTERNAL_NAME
                        ? ADMIN_DISPLAY_NAME
                        : name,

                lastSeen:
                    serverTimestamp(),

                online: true
            },
            {
                merge: true
            }
        );


        profile = {
            username: internalName,

            displayName:
                internalName ===
                ADMIN_INTERNAL_NAME
                    ? ADMIN_DISPLAY_NAME
                    : name
        };


        localStorage.setItem(
            USERNAME_KEY,
            name
        );


        loginScreen.classList.add(
            "hidden"
        );

        appElement.classList.remove(
            "hidden"
        );


        await determineAdmin();

        updateAccountUI();

        setupRoom();

    }
    catch (error) {

        console.error(error);

        loginError.textContent =
            "Unable to enter chat.";

    }

}


// ============================================================
// ADMIN CHECK
// ============================================================
//
// The important part:
//
// We DON'T trust the username.
//
// The admin UID must have an entry in:
//
// admins/{uid}
//
// Create that document manually in Firebase Console
// after you've logged in once.
//

async function determineAdmin() {

    if (!currentUser) return;

    const adminRef =
        doc(
            db,
            "admins",
            currentUser.uid
        );

    const snapshot =
        await getDoc(adminRef);

    currentAdmin =
        snapshot.exists();

}


// ============================================================
// UI ACCOUNT
// ============================================================

function updateAccountUI() {

    const display =
        profile?.displayName ||
        "User";

    myUsername.textContent =
        display;

    myAvatar.textContent =
        display
            .charAt(0)
            .toUpperCase();

    myRole.textContent =
        currentAdmin
            ? "Administrator"
            : "Member";


    $("adminSettings")
        .classList.toggle(
            "hidden",
            !currentAdmin
        );

}


// ============================================================
// CHANNELS
// ============================================================

const DEFAULT_CHANNELS = [
    "general",
    "random",
    "band-general",
    "announcements"
];


function renderChannels() {

    channelList.innerHTML = "";

    DEFAULT_CHANNELS.forEach(
        channel => {

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "channel";

            if (
                channel === currentChannel
            ) {

                button.classList.add(
                    "active"
                );

            }


            button.innerHTML = `
                <span class="channel-symbol">#</span>
                <span>${escapeHTML(channel)}</span>
            `;


            button.addEventListener(
                "click",
                () => {

                    currentChannel =
                        channel;

                    renderChannels();

                    channelTitle.textContent =
                        "# " + channel;

                    messageInput.placeholder =
                        "Message #" + channel;

                    subscribeMessages();

                }
            );


            channelList.appendChild(
                button
            );

        }
    );

}


renderChannels();


// ============================================================
// ROOM
// ============================================================

function setupRoom() {

    roomCode.textContent =
        currentRoom;

    localStorage.setItem(
        ROOM_KEY,
        currentRoom
    );

    subscribeUsers();

    subscribeMessages();

    subscribeRoomStatus();

}


$("roomButton")
    .addEventListener(
        "click",
        () => {

            roomCode.textContent =
                currentRoom;

            roomModal.classList.remove(
                "hidden"
            );

        }
    );


$("joinRoomButton")
    .addEventListener(
        "click",
        () => {

            const room =
                roomInput.value
                    .trim()
                    .toLowerCase();


            if (!room) return;


            if (
                room.length < 3 ||
                room.length > 32
            ) {

                alert(
                    "Invalid room code."
                );

                return;

            }


            currentRoom =
                room;

            localStorage.setItem(
                ROOM_KEY,
                room
            );


            roomModal.classList.add(
                "hidden"
            );


            subscribeUsers();

            subscribeMessages();

            subscribeRoomStatus();

        }
    );


$("copyRoomButton")
    .addEventListener(
        "click",
        async () => {

            await navigator.clipboard.writeText(
                currentRoom
            );

        }
    );


$("shareRoomButton")
    .addEventListener(
        "click",
        async () => {

            const shareText =
                `Join my WebChat room: ${currentRoom}`;


            if (
                navigator.share
            ) {

                try {

                    await navigator.share({
                        title: "WebChat",
                        text: shareText
                    });

                }
                catch {}

            }
            else {

                await navigator.clipboard.writeText(
                    currentRoom
                );

                alert(
                    "Room code copied."
                );

            }

        }
    );


// ============================================================
// ROOM STATUS
// ============================================================

function subscribeRoomStatus() {

    if (unsubscribeRoom) {
        unsubscribeRoom();
    }


    const roomRef =
        doc(
            db,
            "rooms",
            currentRoom
        );


    unsubscribeRoom =
        onSnapshot(
            roomRef,
            snapshot => {

                if (!snapshot.exists()) {

                    setDoc(
                        roomRef,
                        {
                            createdAt:
                                serverTimestamp(),

                            messageLimit:
                                MAX_MESSAGES
                        },
                        {
                            merge: true
                        }
                    );

                }

            }
        );

}


// ============================================================
// USERS
// ============================================================

async function markOnline() {

    if (!currentUser) return;

    await setDoc(
        doc(
            db,
            "rooms",
            currentRoom,
            "members",
            currentUser.uid
        ),
        {
            uid:
                currentUser.uid,

            username:
                profile.username,

            displayName:
                profile.displayName,

            online: true,

            lastSeen:
                serverTimestamp()
        },
        {
            merge: true
        }
    );

}


async function subscribeUsers() {

    if (unsubscribeUsers) {
        unsubscribeUsers();
    }


    await markOnline();


    const membersRef =
        collection(
            db,
            "rooms",
            currentRoom,
            "members"
        );


    unsubscribeUsers =
        onSnapshot(
            membersRef,
            snapshot => {

                users.clear();


                snapshot.forEach(
                    document => {

                        const data =
                            document.data();

                        users.set(
                            document.id,
                            data
                        );

                    }
                );


                renderUsers();

            }
        );

}


function renderUsers() {

    userList.innerHTML = "";

    const entries =
        [...users.values()]
            .filter(user =>
                user.online !== false
            );


    onlineCount.textContent =
        entries.length;


    entries.forEach(
        user => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "user-row";


            const display =
                user.displayName ||
                cleanDisplayName(
                    user.username
                );


            const admin =
                user.uid ===
                currentUser?.uid &&
                currentAdmin;


            row.innerHTML = `
                <div class="avatar">
                    ${escapeHTML(
                        display
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="user-name">
                    ${escapeHTML(display)}
                </div>

                ${
                    admin
                    ?
                    `<span class="admin-badge">
                        ADMIN
                    </span>`
                    :
                    ""
                }
            `;


            userList.appendChild(
                row
            );

        }
    );

}


// ============================================================
// MESSAGES
// ============================================================

function messagesRef() {

    return collection(
        db,
        "rooms",
        currentRoom,
        "messages"
    );

}


function subscribeMessages() {

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }


    messagesElement.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">#</div>
            <h1>Loading #${escapeHTML(currentChannel)}</h1>
        </div>
    `;


    const q =
        query(
            messagesRef(),

            where(
                "channel",
                "==",
                currentChannel
            ),

            orderBy(
                "createdAt",
                "asc"
            ),

            limit(
                MAX_MESSAGES
            )
        );


    unsubscribeMessages =
        onSnapshot(
            q,

            snapshot => {

                messageCache =
                    snapshot.docs.map(
                        document => ({
                            id:
                                document.id,

                            ...document.data()
                        })
                    );


                renderMessages();

            },

            error => {

                console.error(error);

                messagesElement.innerHTML = `
                    <div class="welcome">
                        <h1>Unable to load messages</h1>
                        <p>
                            Check your Firebase Firestore
                            rules and configuration.
                        </p>
                    </div>
                `;

            }
        );

}


// ============================================================
// IMAGE ATTACH
// ============================================================

attachButton.addEventListener(
    "click",
    () => {
        imageInput.click();
    }
);

imageInput.addEventListener(
    "change",
    async () => {
        const file =
            imageInput.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            imageInput.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be under 5MB.");
            imageInput.value = "";
            return;
        }

        pendingImageFile = file;

        const reader = new FileReader();

        reader.onload = event => {
            pendingImageDataUrl =
                event.target.result;

            imagePreview.innerHTML = `
                <img src="${pendingImageDataUrl}" class="preview-image">
                <button type="button" id="removeImage" class="remove-image">×</button>
            `;

            imagePreview.classList.remove("hidden");

            const remove =
                $("removeImage");

            if (remove) {
                remove.addEventListener(
                    "click",
                    clearPendingImage
                );
            }
        };

        reader.readAsDataURL(file);
    }
);

function clearPendingImage() {
    pendingImageFile = null;
    pendingImageDataUrl = null;
    imageInput.value = "";
    imagePreview.classList.add("hidden");
    imagePreview.innerHTML = "";
}

// ============================================================
// NSFW / MODERATION HELPERS
// ============================================================

let nsfwModelPromise = null;

async function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load " + src));
        document.head.appendChild(script);
    });
}

async function getNsfwModel() {
    if (nsfwModelPromise) return nsfwModelPromise;

    nsfwModelPromise = (async () => {
        await loadScript(
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"
        );

        await loadScript(
            "https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js"
        );

        if (!window.nsfwjs) {
            throw new Error("nsfwjs not available");
        }

        return await window.nsfwjs.load();
    })();

    return nsfwModelPromise;
}

async function fileToImageElement(fileOrDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image load failed"));

        if (typeof fileOrDataUrl === "string") {
            img.src = fileOrDataUrl;
        } else {
            const reader = new FileReader();
            reader.onload = e => { img.src = e.target.result; };
            reader.onerror = reject;
            reader.readAsDataURL(fileOrDataUrl);
        }
    });
}

async function checkImageContent(fileOrDataUrl) {
    try {
        const model = await getNsfwModel();
        const img = await fileToImageElement(
            fileOrDataUrl instanceof File
                ? fileOrDataUrl
                : fileOrDataUrl
        );

        const predictions = await model.classify(img);

        const bad = predictions.find(p =>
            ["Porn", "Hentai", "Sexy"].includes(p.className) &&
            p.probability > 0.55
        );

        if (bad) {
            return {
                inappropriate: true,
                reason: `Inappropriate image detected (${bad.className}, ${Math.round(bad.probability * 100)}%)`
            };
        }

        return { inappropriate: false, reason: null };
    } catch (error) {
        console.error("NSFW check failed:", error);
        // Fail open to keep image sending functional if moderation unavailable.
        return { inappropriate: false, reason: "moderation_unavailable" };
    }
}

function checkTextContent(text) {
    const lower = (text || "").toLowerCase();
    const hit = BANNED_WORDS.find(word => lower.includes(word));
    if (hit) {
        return {
            inappropriate: true,
            reason: `Blocked word detected: "${hit}"`
        };
    }
    return { inappropriate: false, reason: null };
}

async function recordFlaggedAttempt({ type, reason, content }) {
    try {
        const flaggedRef = await addDoc(
            collection(db, "rooms", currentRoom, "flagged"),
            {
                type,
                reason,
                content,
                authorUid: currentUser.uid,
                author: profile.username,
                displayName: profile.displayName,
                channel: currentChannel,
                createdAt: serverTimestamp(),
                reviewed: false
            }
        );

        return flaggedRef.id;
    } catch (error) {
        console.error("Failed to record flagged attempt:", error);
        return null;
    }
}

async function postSystemMessage(text, flaggedId = null) {
    try {
        await addDoc(
            messagesRef(),
            {
                authorUid: "system",
                author: "System",
                displayName: "System",
                text,
                channel: currentChannel,
                createdAt: serverTimestamp(),
                dontDelete: true,
                edited: false,
                isSystem: true,
                flaggedId
            }
        );
    } catch (error) {
        console.error("Failed to post system message:", error);
    }
}

// ============================================================
// SEND MESSAGE
// ============================================================

messageForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const text =
            messageInput.value.trim();

        if (!text && !pendingImageFile) return;

        if (!profile) return;

        // Text filtering
        if (text) {
            const textCheck =
                checkTextContent(text);

            if (textCheck.inappropriate) {
                const flaggedId =
                    await recordFlaggedAttempt({
                        type: "text",
                        reason: textCheck.reason,
                        content: text
                    });

                await postSystemMessage(
                    `⚠️ ${cleanDisplayName(profile.displayName)} attempted to send inappropriate text and was blocked. (${textCheck.reason})`,
                    flaggedId
                );

                messageInput.value = "";
                resizeInput();
                hideMentionSuggestions();
                clearPendingImage();
                return;
            }
        }

        // Image handling
        let imageUrl = null;

        if (pendingImageFile) {
            const imageCheck =
                await checkImageContent(
                    pendingImageFile
                );

            if (imageCheck.inappropriate) {
                const flaggedId =
                    await recordFlaggedAttempt({
                        type: "image",
                        reason: imageCheck.reason,
                        content: pendingImageDataUrl
                    });

                await postSystemMessage(
                    `⚠️ ${cleanDisplayName(profile.displayName)} attempted to send an inappropriate image and was blocked. (${imageCheck.reason})`,
                    flaggedId
                );

                clearPendingImage();
                return;
            }

            try {
                const file = pendingImageFile;
                const path =
                    `rooms/${currentRoom}/images/${Date.now()}_${file.name}`;

                const ref =
                    storageRef(
                        storage,
                        path
                    );

                await uploadBytes(
                    ref,
                    file
                );

                imageUrl =
                    await getDownloadURL(ref);
            }
            catch (error) {
                console.error(error);
                alert("Image could not be uploaded.");
                return;
            }
        }

        try {
            const messageData = {
                authorUid:
                    currentUser.uid,

                author:
                    profile.username,

                displayName:
                    profile.displayName,

                text:
                    text,

                channel:
                    currentChannel,

                createdAt:
                    serverTimestamp(),

                dontDelete:
                    false,

                edited:
                    false
            };

            if (imageUrl) {
                messageData.imageUrl =
                    imageUrl;
            }

            await addDoc(
                messagesRef(),
                messageData
            );

            messageInput.value = "";
            resizeInput();
            hideMentionSuggestions();
            clearPendingImage();

            if (currentAdmin) {
                await cleanupOldMessages();
            }
        }
        catch (error) {
            console.error(error);
            alert("Message could not be sent.");
        }

    }
);


// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages() {

    messagesElement.innerHTML = "";


    if (!messageCache.length) {

        messagesElement.innerHTML = `
            <div class="welcome">
                <div class="welcome-icon">#</div>

                <h1>
                    Welcome to #${escapeHTML(
                        currentChannel
                    )}
                </h1>

                <p>
                    This is the beginning of this channel.
                </p>
            </div>
        `;

        return;

    }


    messageCache.forEach(
        message => {

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                message.isSystem
                    ? "message system-message"
                    : "message";


            const display =
                cleanDisplayName(
                    message.displayName ||
                    message.author
                );


            const protectedMessage =
                message.dontDelete === true;


            const timestamp =
                message.createdAt?.toDate
                    ? message.createdAt
                        .toDate()
                        .toLocaleTimeString(
                            [],
                            {
                                hour:
                                    "numeric",

                                minute:
                                    "2-digit"
                            }
                        )
                    : "";


            const canEdit =
                message.authorUid ===
                currentUser.uid;


            const canDelete =
                canEdit ||
                currentAdmin;


            element.innerHTML = `
                <div class="message-avatar">
                    ${escapeHTML(
                        display
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="message-body">

                    <div class="message-header">

                        <span class="message-author">
                            ${escapeHTML(display)}
                        </span>

                        <span class="message-time">
                            ${timestamp}
                        </span>

                        ${
                            message.edited
                            ?
                            `<span class="message-edited">
                                edited
                            </span>`
                            :
                            ""
                        }

                        ${
                            protectedMessage
                            ?
                            `<span class="message-protected">
                                🔒 Don't Delete
                            </span>`
                            :
                            ""
                        }

                    </div>

                    <div class="message-text">
                        ${formatMessage(
                            message.text || ""
                        )}
                    </div>

                    ${
                        message.imageUrl
                        ?
                        `<div class="message-image-wrap">
                            <img
                                src="${escapeHTML(message.imageUrl)}"
                                class="message-image"
                                alt="image"
                            >
                        </div>`
                        :
                        ""
                    }

                    ${
                        message.flaggedId && currentAdmin
                        ?
                        `<button
                            class="view-flagged-button"
                            data-flagged="${escapeHTML(message.flaggedId)}"
                        >
                            🔍 View attempted content
                        </button>`
                        :
                        ""
                    }

                    ${
                        !message.isSystem
                        ?
                        `<button
                            class="flag-message-button"
                            data-flagmsg="${escapeHTML(message.id)}"
                        >
                            🚩 Flag
                        </button>`
                        :
                        ""
                    }

                </div>

                ${
                    canEdit || canDelete || currentAdmin
                    ?
                    `
                    <div class="message-actions">

                        ${
                            canEdit
                            ?
                            `
                            <button
                                data-action="edit"
                            >
                                ✎
                            </button>
                            `
                            :
                            ""
                        }

                        ${
                            canDelete
                            ?
                            `
                            <button
                                data-action="delete"
                            >
                                🗑
                            </button>
                            `
                            :
                            ""
                        }

                        ${
                            currentAdmin
                            ?
                            `
                            <button
                                data-action="admin"
                            >
                                ⋮
                            </button>
                            `
                            :
                            ""
                        }

                    </div>
                    `
                    :
                    ""
                }
            `;


            const edit =
                element.querySelector(
                    '[data-action="edit"]'
                );


            if (edit) {

                edit.addEventListener(
                    "click",
                    () =>
                        editMessage(message)
                );

            }


            const deleteButton =
                element.querySelector(
                    '[data-action="delete"]'
                );


            if (deleteButton) {

                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteMessage(message)
                );

            }


            const adminButton =
                element.querySelector(
                    '[data-action="admin"]'
                );


            if (adminButton) {

                adminButton.addEventListener(
                    "click",
                    event => {

                        openMessageMenu(
                            message,
                            event
                        );

                    }
                );

            }


            const viewFlaggedButton =
                element.querySelector(
                    ".view-flagged-button"
                );

            if (viewFlaggedButton) {
                viewFlaggedButton.addEventListener(
                    "click",
                    () => {
                        viewFlaggedContent(
                            viewFlaggedButton.dataset.flagged
                        );
                    }
                );
            }

            const flagMessageButton =
                element.querySelector(
                    ".flag-message-button"
                );

            if (flagMessageButton) {
                flagMessageButton.addEventListener(
                    "click",
                    () => {
                        flagMessage(message);
                    }
                );
            }

            messagesElement.appendChild(
                element
            );

        }
    );


    messagesElement.scrollTop =
        messagesElement.scrollHeight;

}


// ============================================================
// FLAG MESSAGE (USER)
// ============================================================

async function flagMessage(message) {
    if (!message) return;

    const authorDisplay =
        cleanDisplayName(
            message.displayName || message.author
        );

    const type =
        message.imageUrl ? "image" : "text";

    const content =
        message.imageUrl || message.text || "";

    const flaggedId = await recordFlaggedAttempt({
        type,
        reason: "User flagged",
        content
    });

    await postSystemMessage(
        `🚩 ${cleanDisplayName(profile.displayName)} flagged a message by ${authorDisplay}.`,
        flaggedId
    );
}

// ============================================================
// VIEW FLAGGED CONTENT (ADMIN)
// ============================================================

async function viewFlaggedContent(flaggedId) {
    if (!currentAdmin) return;

    try {
        const docRef = doc(
            db,
            "rooms",
            currentRoom,
            "flagged",
            flaggedId
        );

        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            alert("Flagged content not found.");
            return;
        }

        const data = snapshot.data();
        const container = $("flaggedContent");
        container.innerHTML = "";

        const info = document.createElement("div");
        info.innerHTML = `
            <p><strong>User:</strong> ${escapeHTML(cleanDisplayName(data.displayName || data.author))}</p>
            <p><strong>Type:</strong> ${escapeHTML(data.type)}</p>
            <p><strong>Reason:</strong> ${escapeHTML(data.reason || "")}</p>
            <p><strong>When:</strong> ${data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : ""}</p>
        `;
        container.appendChild(info);

        if (data.type === "image" && data.content) {
            const img = document.createElement("img");
            img.src = data.content;
            img.className = "flagged-image";
            img.alt = "flagged image";
            container.appendChild(img);
        } else if (data.type === "text") {
            const pre = document.createElement("pre");
            pre.className = "flagged-text";
            pre.textContent = data.content || "";
            container.appendChild(pre);
        }

        $("flaggedModal").classList.remove("hidden");
    } catch (error) {
        console.error(error);
        alert("Unable to load flagged content.");
    }
}

// ============================================================
// FORMAT TEXT
// ============================================================

function formatMessage(text) {

    let output =
        escapeHTML(text);


    output =
        output.replace(
            /@everyone\b/gi,
            '<span class="mention everyone">@everyone</span>'
        );


    output =
        output.replace(
            /@([a-zA-Z0-9_]+)/g,
            '<span class="mention">@$1</span>'
        );


    return output;

}


function cleanDisplayName(name) {

    /*
        The actual admin name can contain the star.

        We NEVER display the star.
    */

    return name
        .replace("⭐", "")
        .trim();

}


// ============================================================
// EDIT
// ============================================================

async function editMessage(message) {

    const text =
        prompt(
            "Edit message:",
            message.text
        );


    if (
        text === null ||
        !text.trim()
    ) return;


    try {

        await updateDoc(
            doc(
                db,
                "rooms",
                currentRoom,
                "messages",
                message.id
            ),
            {
                text:
                    text.trim(),

                edited:
                    true
            }
        );

    }
    catch (error) {

        console.error(error);

        alert(
            "You cannot edit that message."
        );

    }

}


// ============================================================
// DELETE
// ============================================================

async function deleteMessage(message) {

    if (
        !currentAdmin &&
        message.authorUid !==
            currentUser.uid
    ) {

        return;

    }


    if (
        message.dontDelete &&
        !currentAdmin
    ) {

        alert(
            "This message is protected."
        );

        return;

    }


    if (
        !confirm(
            "Delete this message?"
        )
    ) return;


    try {

        await deleteDoc(
            doc(
                db,
                "rooms",
                currentRoom,
                "messages",
                message.id
            )
        );

    }
    catch (error) {

        console.error(error);

        alert(
            "Unable to delete message."
        );

    }

}


// ============================================================
// ADMIN MESSAGE MENU
// ============================================================

function openMessageMenu(
    message,
    event
) {

    selectedMessage =
        message;


    const menu =
        $("messageMenu");


    menu.classList.remove(
        "hidden"
    );


    menu.style.left =
        event.clientX + "px";

    menu.style.top =
        event.clientY + "px";


    $("protectMessageButton")
        .classList.toggle(
            "hidden",
            message.dontDelete === true
        );


    $("unprotectMessageButton")
        .classList.toggle(
            "hidden",
            message.dontDelete !== true
        );

}


document.addEventListener(
    "click",
    event => {

        const menu =
            $("messageMenu");


        if (
            !menu.contains(
                event.target
            )
        ) {

            menu.classList.add(
                "hidden"
            );

        }

    }
);


// ============================================================
// PROTECT MESSAGE
// ============================================================

$("protectMessageButton")
    .addEventListener(
        "click",
        async () => {

            if (
                !currentAdmin ||
                !selectedMessage
            ) return;


            await updateDoc(
                doc(
                    db,
                    "rooms",
                    currentRoom,
                    "messages",
                    selectedMessage.id
                ),
                {
                    dontDelete:
                        true
                }
            );


            $("messageMenu")
                .classList.add(
                    "hidden"
                );

        }
    );


$("unprotectMessageButton")
    .addEventListener(
        "click",
        async () => {

            if (
                !currentAdmin ||
                !selectedMessage
            ) return;


            await updateDoc(
                doc(
                    db,
                    "rooms",
                    currentRoom,
                    "messages",
                    selectedMessage.id
                ),
                {
                    dontDelete:
                        false
                }
            );


            $("messageMenu")
                .classList.add(
                    "hidden"
                );

        }
    );


// ============================================================
// ADMIN DELETE
// ============================================================

$("adminDeleteButton")
    .addEventListener(
        "click",
        async () => {

            if (
                !currentAdmin ||
                !selectedMessage
            ) return;


            await deleteMessage(
                selectedMessage
            );


            $("messageMenu")
                .classList.add(
                    "hidden"
                );

        }
    );


// ============================================================
// MESSAGE CLEANUP
// ============================================================

async function cleanupOldMessages() {

    if (!currentAdmin) return;


    const q =
        query(
            messagesRef(),

            where(
                "channel",
                "==",
                currentChannel
            ),

            orderBy(
                "createdAt",
                "asc"
            )
        );


    const snapshot =
        await getDocs(q);


    const all =
        snapshot.docs;


    if (
        all.length <=
        MAX_MESSAGES
    ) {

        return;

    }


    const excess =
        all.length -
        MAX_MESSAGES;


    const batch =
        writeBatch(db);


    let removed = 0;


    for (
        const document of all
    ) {

        if (
            removed >= excess
        ) break;


        const data =
            document.data();


        if (
            data.dontDelete === true
        ) {

            continue;

        }


        batch.delete(
            document.ref
        );


        removed++;

    }


    if (removed > 0) {

        await batch.commit();

    }

}


// ============================================================
// MANUAL CLEANUP
// ============================================================

$("cleanupButton")
    .addEventListener(
        "click",
        async () => {

            if (!currentAdmin) return;

            await cleanupOldMessages();

            alert(
                "Old unprotected messages cleaned."
            );

        }
    );


// ============================================================
// CLEAR CHANNEL
// ============================================================

$("clearChannelButton")
    .addEventListener(
        "click",
        async () => {

            if (!currentAdmin) return;


            if (
                !confirm(
                    `Delete all UNPROTECTED messages in #${currentChannel}?`
                )
            ) return;


            const q =
                query(
                    messagesRef(),

                    where(
                        "channel",
                        "==",
                        currentChannel
                    )
                );


            const snapshot =
                await getDocs(q);


            const batch =
                writeBatch(db);


            snapshot.forEach(
                document => {

                    if (
                        document.data()
                            .dontDelete !== true
                    ) {

                        batch.delete(
                            document.ref
                        );

                    }

                }
            );


            await batch.commit();

        }
    );


// ============================================================
// MENTION AUTOCOMPLETE
// ============================================================

messageInput.addEventListener(
    "input",
    () => {

        resizeInput();


        const cursor =
            messageInput.selectionStart;


        const before =
            messageInput.value
                .slice(0, cursor);


        const match =
            before.match(
                /@([a-zA-Z0-9_]*)$/
            );


        if (!match) {

            hideMentionSuggestions();

            return;

        }


        const search =
            match[1].toLowerCase();


        const matching =
            [...users.values()]
                .filter(
                    user => {

                        const name =
                            cleanDisplayName(
                                user.displayName ||
                                user.username
                            );

                        return name
                            .toLowerCase()
                            .startsWith(
                                search
                            );

                    }
                )
                .slice(0, 8);


        if (!matching.length) {

            hideMentionSuggestions();

            return;

        }


        mentionSuggestions.innerHTML =
            "";


        matching.forEach(
            user => {

                const display =
                    cleanDisplayName(
                        user.displayName ||
                        user.username
                    );


                const button =
                    document.createElement(
                        "button"
                    );


                button.className =
                    "mention-option";


                button.textContent =
                    "@" + display;


                button.addEventListener(
                    "click",
                    () => {

                        const start =
                            cursor -
                            match[0].length;


                        messageInput.value =
                            messageInput.value
                                .slice(0, start) +
                            "@" +
                            display +
                            " " +
                            messageInput.value
                                .slice(cursor);


                        hideMentionSuggestions();

                        messageInput.focus();

                    }
                );


                mentionSuggestions.appendChild(
                    button
                );

            }
        );


        mentionSuggestions.classList.remove(
            "hidden"
        );

    }
);


function hideMentionSuggestions() {

    mentionSuggestions.classList.add(
        "hidden"
    );

}


// ============================================================
// TEXTAREA
// ============================================================

function resizeInput() {

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            150
        ) + "px";

}


messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            messageForm.requestSubmit();

        }

    }
);


// ============================================================
// SETTINGS
// ============================================================

$("settingsButton")
    .addEventListener(
        "click",
        () => {

            $("settingsUsername").value =
                profile?.displayName || "";

            settingsModal.classList.remove(
                "hidden"
            );

        }
    );


$("saveSettingsButton")
    .addEventListener(
        "click",
        async () => {

            const newName =
                $("settingsUsername")
                    .value
                    .trim()
                    .replace(
                        /\s+/g,
                        "_"
                    );


            if (!newName) return;


            /*
                Don't allow normal users to pretend
                to be the admin's display name.
            */

            if (
                newName ===
                ADMIN_DISPLAY_NAME &&
                !currentAdmin
            ) {

                alert(
                    "That username is reserved."
                );

                return;

            }


            const internalName =
                currentAdmin
                    ? ADMIN_INTERNAL_NAME
                    : newName;


            await setDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid
                ),
                {
                    username:
                        internalName,

                    displayName:
                        currentAdmin
                            ? ADMIN_DISPLAY_NAME
                            : newName,

                    lastSeen:
                        serverTimestamp(),

                    online:
                        true
                },
                {
                    merge: true
                }
            );


            profile.username =
                internalName;

            profile.displayName =
                currentAdmin
                    ? ADMIN_DISPLAY_NAME
                    : newName;


            localStorage.setItem(
                USERNAME_KEY,
                newName
            );


            updateAccountUI();

            settingsModal.classList.add(
                "hidden"
            );

        }
    );


// ============================================================
// MODAL CLOSE
// ============================================================

document
    .querySelectorAll(
        "[data-close]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    $(button.dataset.close)
                        .classList.add(
                            "hidden"
                        );

                }
            );

        }
    );


// ============================================================
// WELCOME POPUP (FIRST VISIT)
// ============================================================

const welcomePopup =
    $("welcomePopup");

const welcomeOkButton =
    $("welcomeOkButton");

if (
    welcomePopup &&
    !localStorage.getItem("webchat_welcome_seen")
) {
    welcomePopup.classList.remove("hidden");
}

if (welcomeOkButton) {
    welcomeOkButton.addEventListener(
        "click",
        () => {
            localStorage.setItem(
                "webchat_welcome_seen",
                "true"
            );

            welcomePopup.classList.add(
                "hidden"
            );
        }
    );
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text ?? "";

    return div.innerHTML;

}
