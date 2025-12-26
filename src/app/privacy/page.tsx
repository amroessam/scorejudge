import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - ScoreJudge",
  description: "Privacy Policy for ScoreJudge",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-6 safe-pb">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            href="/"
            className="text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors inline-flex items-center gap-2 mb-4"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
            Privacy Policy
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-[var(--foreground)]">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              ScoreJudge ("we", "our", or "us") operates the ScoreJudge web application (the "Service"). 
              This Privacy Policy informs you of our policies regarding the collection, use, and disclosure 
              of personal data when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold mb-3">2.1 Google Account Information</h3>
            <p>
              When you sign in with Google, we collect the following information from your Google account:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email address</li>
              <li>Name</li>
              <li>Google account ID</li>
            </ul>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Google Drive and Sheets Access</h3>
            <p>
              With your explicit consent, we access your Google Drive and Google Sheets to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create game score sheets in your Google Drive</li>
              <li>Store game data in Google Sheets</li>
              <li>Share game sheets with other players (view-only access)</li>
            </ul>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">2.3 Game Data</h3>
            <p>
              We store game-related information including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Game names</li>
              <li>Player scores, bids, and tricks</li>
              <li>Round information</li>
              <li>Game ownership and player associations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p>We use the collected information for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and maintain our Service</li>
              <li>To authenticate your identity</li>
              <li>To create and manage game score sheets in your Google Drive</li>
              <li>To enable real-time game updates via WebSocket connections</li>
              <li>To share game sheets with other players you invite</li>
              <li>To provide customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Storage</h2>
            <p>
              Your game data is stored in Google Sheets within your Google Drive. We do not maintain 
              a separate database. Game data is stored temporarily in server memory during active gameplay 
              sessions for real-time updates, but persistent storage is handled entirely through Google Sheets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing</h2>
            <p>
              We share your game data only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>With Other Players:</strong> When you create or join a game, the game sheet 
                is shared with other players in that game with view-only access.
              </li>
              <li>
                <strong>With Google:</strong> We use Google's services (OAuth, Drive API, Sheets API) 
                to provide our Service. Your use of these services is subject to Google's Privacy Policy.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose your information if required by law 
                or in response to valid requests by public authorities.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data stored in Google Sheets</li>
              <li>Delete game data by removing Google Sheets from your Drive</li>
              <li>Revoke our access to your Google account through Google Account settings</li>
              <li>Request information about the data we process</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal data. 
              However, no method of transmission over the Internet or electronic storage is 100% secure. 
              We use secure authentication (OAuth 2.0) and encrypted connections (HTTPS/WSS) for all data transmission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking</h2>
            <p>
              We use session cookies to maintain your authentication state. These cookies are essential 
              for the Service to function and are not used for tracking or advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under the age of 13. We do not knowingly collect 
              personal information from children under 13. If you are a parent or guardian and believe 
              your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us through your Google 
              account associated with the Service or by reviewing the game sheets created in your Google Drive.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

