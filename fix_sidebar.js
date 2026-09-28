
const fs = require("fs");
const path = "src/components/Sidebar.tsx";
let code = fs.readFileSync(path, "utf-8");

// Fix the memory leak in useEffect
code = code.replace(
  /const unsubscribeAuth = onAuthStateChanged\(auth, \(currentUser\) => \{[\s\S]*?return \(\) => unsubscribeAuth\(\);\s*\}, \[\]\);/,
  `let unsubscribeSnapshot;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const q = query(collection(db, "team_messages"), where("read", "==", false));
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          let count = 0; let hasNew = false;
          snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
              const data = change.doc.data();
              if (data.uid !== currentUser.uid && data.roomId && data.roomId.includes(currentUser.email)) {
                hasNew = true;
              }
            }
          });
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid !== currentUser.uid && typeof data.read !== "undefined" && data.roomId && data.roomId.includes(currentUser.email)) {
              count++;
            }
          });
          setUnreadCount(count);
          if (initialLoad.current) {
            initialLoad.current = false;
          } else if (hasNew) {
            const tone = localStorage.getItem("notificationTone") || "/tones/tone1.wav";
            const audio = new Audio(tone);
            audio.play().catch(() => {});
          }
        }, (err) => console.warn("Dev snapshot err:", err));
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        setUnreadCount(0);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);`
);

// Add the signout states
code = code.replace(
  /const initialLoad = useRef\(true\);/,
  `const initialLoad = useRef(true);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [workNote, setWorkNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);`
);

// Save email
code = code.replace(
  `if (currentUser) {`,
  `if (currentUser) {\n        setCurrentUserEmail(currentUser.email);`
);

// Replace handleSignOut with the new restricted logic
code = code.replace(
  /const handleSignOut = async \(\) => \{[\s\S]*?\};\s*return \(/,
  `const handleSignOutClick = () => {
    const currentHour = new Date().getHours();
    if (currentHour < 18) { // 18 is 6:00 PM
      alert("You can only sign out after 6:00 PM.");
      return;
    }
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    if (!workNote.trim()) {
      alert("Please write a brief note on what you worked on today.");
      return;
    }
    setIsSubmittingNote(true);
    try {
      if (currentUserEmail) {
        const usersSnap = await getDocs(collection(db, "users"));
        if (!usersSnap.empty) {
          const founderDoc = usersSnap.docs.find(doc => doc.data().role === "Founder") || usersSnap.docs[0];
          const founderUid = founderDoc.id;
          const roomId = \`\${founderUid}_\${currentUserEmail}\`;
          
          await addDoc(collection(db, "team_messages"), {
            text: \`👋 I have signed out for the day.\\n\\n📝 **Work Note:**\\n\${workNote}\`,
            uid: auth.currentUser?.uid || "",
            roomId: roomId,
            createdAt: serverTimestamp(),
            senderName: auth.currentUser?.displayName || currentUserEmail.split("@")[0],
            senderRole: "Developer",
            senderPicUrl: auth.currentUser?.photoURL || "",
            read: false
          });
        }
      }
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (`
);

// Replace the button onClick to handleSignOutClick
code = code.replace(
  `onClick={handleSignOut}`,
  `onClick={handleSignOutClick}`
);

// Add the modal to the very end of the component
code = code.replace(
  /<\/aside>\s*\);\s*\}/,
  `</aside>
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-2">Sign Out</h2>
              <p className="text-sm text-muted-foreground mb-4">
                You're signing out for the day. Please write a brief note on what you accomplished.
              </p>
              
              <textarea
                value={workNote}
                onChange={(e) => setWorkNote(e.target.value)}
                placeholder="E.g., Finished the UI for the dashboard, fixed 2 bugs..."
                className="w-full h-32 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-6"
              />

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSignOutModal(false)}
                  disabled={isSubmittingNote}
                  className="flex-1 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSignOut}
                  disabled={isSubmittingNote}
                  className="flex-1 px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 font-medium transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingNote ? "Saving..." : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}`
);

code = code.replace("return (\\n    <aside", "return (\\n    <>\\n      <aside");

fs.writeFileSync(path, code);
console.log("Updated Sidebar.tsx!");
