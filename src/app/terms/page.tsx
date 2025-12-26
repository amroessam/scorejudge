import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - ScoreJudge",
  description: "Terms of Service for ScoreJudge",
};

export default function TermsOfService() {
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
            Terms of Service
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-[var(--foreground)]">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ScoreJudge ("the Service"), you accept and agree to be bound by 
              the terms and provision of this agreement. If you do not agree to abide by the above, 
              please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              ScoreJudge is a web application that provides a live scorekeeping service for the 
              Judgement card game. The Service allows users to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create and manage game sessions</li>
              <li>Track scores, bids, and tricks in real-time</li>
              <li>Store game data in Google Sheets</li>
              <li>Share games with other players</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <h3 className="text-xl font-semibold mb-3">3.1 Google Authentication</h3>
            <p>
              You must sign in with a Google account to use the Service. By using Google authentication, 
              you agree to comply with Google's Terms of Service and Privacy Policy.
            </p>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">3.2 Account Responsibility</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account and for all 
              activities that occur under your account. You agree to notify us immediately of any 
              unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Permissions and Access</h2>
            <h3 className="text-xl font-semibold mb-3">4.1 Google Drive and Sheets Access</h3>
            <p>
              The Service requires access to your Google Drive and Google Sheets to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create game score sheets in your Google Drive</li>
              <li>Store and update game data</li>
              <li>Share game sheets with other players</li>
            </ul>
            <p className="mt-3">
              You grant us permission to create files in your Google Drive and to share those files 
              with other players you invite to your games. You can revoke this access at any time 
              through your Google Account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Transmit any worms, viruses, or any code of a destructive nature</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Use the Service to harass, abuse, or harm other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Game Data and Ownership</h2>
            <p>
              Game data created through the Service is stored in Google Sheets within your Google Drive. 
              You retain ownership of all data stored in your Google Drive. The Service acts as a tool 
              to help you manage and share this data.
            </p>
            <p className="mt-3">
              When you create a game, you become the game owner and have control over the game sheet 
              in your Google Drive. You can delete the game sheet at any time, which will remove 
              access for all players.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Service Availability</h2>
            <p>
              We strive to provide a reliable Service but do not guarantee that the Service will be 
              available at all times. The Service may be unavailable due to maintenance, technical 
              issues, or other reasons beyond our control. We are not liable for any loss or damage 
              resulting from Service unavailability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ScoreJudge and its operators shall not be liable 
              for any indirect, incidental, special, consequential, or punitive damages, or any loss 
              of profits or revenues, whether incurred directly or indirectly, or any loss of data, 
              use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available" without any warranties of any kind, 
              either express or implied. We do not warrant that the Service will be uninterrupted, 
              secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
            <p>
              The Service integrates with Google services (OAuth, Drive API, Sheets API). Your use of 
              these services is subject to Google's Terms of Service and Privacy Policy. We are not 
              responsible for the availability, accuracy, or reliability of Google's services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service immediately, 
              without prior notice or liability, for any reason, including if you breach these Terms 
              of Service.
            </p>
            <p className="mt-3">
              You may stop using the Service at any time by revoking access through your Google 
              Account settings. Your game data will remain in your Google Drive unless you delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms of Service at any time. If a 
              revision is material, we will provide at least 30 days notice prior to any new terms 
              taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p>
              These Terms of Service shall be governed by and construed in accordance with the laws 
              of the jurisdiction in which the Service operates, without regard to its conflict of law 
              provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us through your 
              Google account associated with the Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

