const fs = require('fs');

function patchFile(path, timeStr) {
  let code = fs.readFileSync(path, 'utf-8');

  if (!code.includes('AlertCircle')) {
    code = code.replace(/} from .lucide-react.;/, ', AlertCircle } from \"lucide-react\";');
  }

  if (!code.includes('showEarlySignOutModal')) {
    if (code.includes('showSignOutModal')) {
      code = code.replace(
        /const \[showSignOutModal, setShowSignOutModal\] = useState\(false\);/,
        'const [showSignOutModal, setShowSignOutModal] = useState(false);\n  const [showEarlySignOutModal, setShowEarlySignOutModal] = useState(false);'
      );
    } else {
      // Telecaller Sidebar uses showModal? Let's check TelecallerSidebar state name.
      code = code.replace(
        /const \[showSignOutModal, setShowSignOutModal\] = useState\(false\);/,
        'const [showSignOutModal, setShowSignOutModal] = useState(false);\n  const [showEarlySignOutModal, setShowEarlySignOutModal] = useState(false);'
      );
    }
  }

  code = code.replace(
    'alert(\"You can only sign out after ' + timeStr + '.\");',
    'setShowEarlySignOutModal(true);'
  );

  const modalUI = \
      <AnimatePresence>
        {showEarlySignOutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Too Early to Sign Out</h2>
              <p className="text-sm text-muted-foreground mb-6">
                You can only sign out after \. Please continue your work until then.
              </p>
              <button 
                onClick={() => setShowEarlySignOutModal(false)}
                className="w-full px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 font-medium transition-opacity"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
\;

  if (!code.includes('Too Early to Sign Out')) {
    const lastTagIndex = code.lastIndexOf('</>');
    if (lastTagIndex !== -1) {
      code = code.slice(0, lastTagIndex) + modalUI + code.slice(lastTagIndex);
    }
  }

  fs.writeFileSync(path, code);
  console.log('Patched', path);
}

patchFile('src/components/Sidebar.tsx', '6:00 PM');
patchFile('src/components/TelecallerSidebar.tsx', '5:00 PM');
