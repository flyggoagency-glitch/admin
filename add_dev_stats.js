
const fs = require("fs");
const path = "src/components/Sidebar.tsx";
let code = fs.readFileSync(path, "utf-8");

// 1. Add states for completed projects and active projects
code = code.replace(
  /const \[currentUserEmail, setCurrentUserEmail\] = useState<string \| null>\(null\);/,
  `const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [activeProjects, setActiveProjects] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);`
);

// 2. Update handleSignOutClick to fetch the stats
code = code.replace(
  /const handleSignOutClick = \(\) => \{[\s\S]*?setShowSignOutModal\(true\);\s*\};/,
  `const handleSignOutClick = async () => {
    const currentHour = new Date().getHours();
    if (currentHour < 18) { // 18 is 6:00 PM
      alert("You can only sign out after 6:00 PM.");
      return;
    }
    
    setShowSignOutModal(true);
    setIsLoadingStats(true);
    
    try {
      if (auth.currentUser?.email) {
        const q = query(collection(db, "projects"), where("assignee", "==", auth.currentUser.email));
        const snap = await getDocs(q);
        
        let active = 0;
        let compToday = 0;
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        snap.forEach(doc => {
          const data = doc.data();
          if (data.status !== "Completed") {
            active++;
          } else {
            if (data.completedAt) {
              const compDate = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
              if (compDate >= startOfToday) {
                compToday++;
              }
            }
          }
        });
        
        setActiveProjects(active);
        setCompletedToday(compToday);
      }
    } catch (e) {
      console.error("Error fetching project stats:", e);
    } finally {
      setIsLoadingStats(false);
    }
  };`
);

// 3. Update the message sent to Founder
code = code.replace(
  /text: \`.*? I have signed out for the day\.\\n\\n.*? \*\*Work Note:\*\*\\n\$\{workNote\}\`,/,
  `text: \`👋 I have signed out for the day.\\n\\n📊 **Daily Report:**\\n• Projects Completed Today: \${completedToday}\\n• Active Projects Remaining: \${activeProjects}\\n\\n📝 **Work Note:**\\n\${workNote}\`,`
);

// 4. Update the modal UI to display the stats
code = code.replace(
  /<p className="text-sm text-muted-foreground mb-4">\s*You are signing out for the day\. Please write a brief note on what you accomplished\.\s*<\/p>/,
  `<p className="text-sm text-muted-foreground mb-4">
                You are signing out for the day. Please review your daily stats and write a brief note.
              </p>
              
              <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-secondary/50 rounded-xl p-3 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Completed Today</div>
                  <div className="text-xl font-bold text-emerald-500">
                    {isLoadingStats ? "..." : completedToday}
                  </div>
                </div>
                <div className="flex-1 bg-secondary/50 rounded-xl p-3 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Active Projects</div>
                  <div className="text-xl font-bold text-blue-500">
                    {isLoadingStats ? "..." : activeProjects}
                  </div>
                </div>
              </div>`
);

fs.writeFileSync(path, code);
console.log("Stats added to dev signout modal!");
