import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — TradeMusic",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-wt-dark">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-wt-dark/60 hover:text-wt-dark transition-colors"
      >
        &larr; Back to TradeMusic
      </Link>

      <h1 className="mb-8 text-2xl font-semibold">Terms of Service</h1>

      <div className="space-y-6 text-sm leading-relaxed text-wt-dark/80">
        <p>
          <strong>Last updated:</strong> April 6, 2026
        </p>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">1. Acceptance of Terms</h2>
          <p>
            By accessing or using TradeMusic, you agree to be bound by these Terms of Service. If you
            do not agree, do not use the service. For questions, contact us at{" "}
            <a href="mailto:info@trademusic.app" className="text-wt-dark underline hover:text-wt-dark/70 transition-colors">
              info@trademusic.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">2. Description of Service</h2>
          <p>
            TradeMusic is a peer-to-peer escrow platform that enables two parties to securely
            exchange audio tracks. No user accounts are required &mdash; identity is established
            through cryptographic secrets scoped to each trade room. The platform provides
            encrypted file transfer, automated audio analysis (BPM detection, spectrogram
            visualization, frequency quality assessment, and waveform previews), and a mutual
            approval mechanism that ensures both parties consent before any exchange is finalized.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">3. Escrow Mechanism</h2>
          <p>
            TradeMusic acts solely as a neutral intermediary. Both participants must independently
            review and approve the proposed exchange. Neither party gains access to the
            other&apos;s content until mutual approval is confirmed. If either party declines, the
            trade is cancelled and no exchange occurs.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">4. User Conduct</h2>
          <p>You agree not to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Upload content you do not have the right to share or trade</li>
            <li>Use the service for any illegal purpose</li>
            <li>Attempt to circumvent or manipulate the escrow mechanism</li>
            <li>Interfere with the proper functioning of the service</li>
            <li>Abuse rate limits or attempt automated access</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">
            5. Intellectual Property
          </h2>
          <p>
            You retain all rights to your content. TradeMusic does not claim any ownership,
            license, or usage rights over your files. We do not access, listen to, or review
            your content &mdash; files are encrypted and only exchanged between participants.
            By using the service, you represent and warrant that you have the necessary rights
            to trade the content you provide.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">6. Encryption &amp; Security</h2>
          <p>
            All uploaded files are encrypted at rest using AES-256-GCM. Participant secrets and
            tokens are verified through timing-safe cryptographic checks. While we implement
            industry-standard security measures, no system is completely immune to risk, and we
            cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">7. Room Lifecycle &amp; Expiration</h2>
          <p>
            Trade rooms expire 24 hours after creation. Access tokens for finalized exchanges are
            also valid for 24 hours. After expiration, all associated data is permanently removed
            from our servers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">8. Data Retention</h2>
          <p>
            Uploaded files and room data are automatically deleted after the trade is completed or
            the room expires. We do not retain, copy, or access traded content at any point.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">
            9. Limitation of Liability
          </h2>
          <p>
            TradeMusic is provided &ldquo;as is&rdquo; without warranties of any kind, express or
            implied. We are not liable for any damages arising from your use of the service,
            including but not limited to loss of data, unauthorized access, service interruptions,
            or disputes between trading parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">10. Contact</h2>
          <p>
            If you have questions about these terms, you can reach us at{" "}
            <a href="mailto:info@trademusic.app" className="text-wt-dark underline hover:text-wt-dark/70 transition-colors">
              info@trademusic.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-wt-dark">11. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Changes take effect immediately upon posting.
            Continued use of the service after changes constitutes acceptance of the updated terms.
          </p>
        </section>
      </div>
    </main>
  );
}
