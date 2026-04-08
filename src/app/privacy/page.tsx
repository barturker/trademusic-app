import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TradeMusic",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-wt-dark">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-wt-dark/60 hover:text-wt-dark transition-colors"
      >
        &larr; Back to TradeMusic
      </Link>

      <h1 className="mb-8 text-2xl font-semibold">Privacy Policy</h1>

      <div className="space-y-6 text-sm leading-relaxed text-wt-dark/80">
        <p>
          <strong>Last updated:</strong> April 6, 2026 &mdash; Questions?{" "}
          <a href="mailto:info@trademusic.app" className="text-wt-dark underline hover:text-wt-dark/70 transition-colors">
            info@trademusic.app
          </a>
        </p>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">1. Information We Collect</h2>
          <p>
            TradeMusic does not require user accounts, email addresses, or any personal information.
            We do not collect, store, or access your audio files &mdash; they are encrypted
            encrypted at rest and held temporarily only to facilitate the trade between participants.
            The only data we process includes:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Encrypted audio files you voluntarily upload, held temporarily until the trade
              completes or expires &mdash; then permanently deleted</li>
            <li>Cryptographically generated participant secrets stored in your browser</li>
            <li>Derived audio metadata (BPM, duration, sample rate, frequency analysis) generated
              during the review process</li>
            <li>Basic connection metadata (IP address, browser type) for rate limiting and security</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">
            2. How We Use Your Information
          </h2>
          <p>We use the collected data solely to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Facilitate the escrow exchange between two participants</li>
            <li>Verify participant identity within a trade room via cryptographic secrets</li>
            <li>Generate audio analysis previews (waveform, spectrogram, BPM, quality assessment) so
              participants can review tracks before approving</li>
            <li>Enforce rate limits and maintain service security</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">3. Encryption</h2>
          <p>
            All uploaded files are encrypted at rest using AES-256-GCM with envelope encryption.
            Participant secrets are hashed before storage and verified through timing-safe
            comparisons. TradeMusic does not have access to the plaintext content of your files
            outside of the automated analysis pipeline.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">4. Data Storage &amp; Retention</h2>
          <p>
            Participant secrets are stored exclusively in your browser&apos;s localStorage &mdash; we
            do not use cookies for tracking or identification. Encrypted files and analysis artifacts
            are held temporarily on our servers and are permanently deleted when the trade completes
            or the room expires (maximum 24 hours). Time-limited access tokens expire after 24 hours.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">5. Data Sharing</h2>
          <p>
            We do not sell, share, or transfer your data to third parties. Uploaded content is only
            accessible to the two participants in the same trade room, and only after mutual approval.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">6. Real-Time Communication</h2>
          <p>
            TradeMusic uses WebSocket connections (Socket.io) to deliver real-time progress updates
            during file analysis. These connections do not transmit personal data and are scoped to
            individual trade rooms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">7. Analytics</h2>
          <p>
            TradeMusic uses Cloudflare Web Analytics for aggregated, privacy-friendly usage metrics.
            This service does not use cookies, does not track individual users, and does not collect
            personal information. We do not use advertising trackers or build user profiles.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">8. Your Rights</h2>
          <p>
            Since we do not collect personal information or require accounts, there is no persistent
            user data to access, modify, or delete. Clearing your browser&apos;s localStorage
            removes all locally stored participant secrets. All server-side data is automatically
            purged upon room expiration.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">9. Contact</h2>
          <p>
            If you have questions about this policy, you can reach us at{" "}
            <a href="mailto:info@trademusic.app" className="text-wt-dark underline hover:text-wt-dark/70 transition-colors">
              info@trademusic.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">10. Changes to This Policy</h2>
          <p>
            We may update this policy at any time. Changes take effect immediately upon posting.
            Continued use of the service constitutes acceptance of the updated policy.
          </p>
        </section>
      </div>
    </main>
  );
}
