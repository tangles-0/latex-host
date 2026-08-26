# PGP messaging: what is it, how it works, and how to use it safely

PGP is Pretty Good Privacy, and is a method of encrypting the **contents** of a message so it can't be read except by the intended recipient. It doesn't make the surrounding activity anonymous and cannot protect a message after either endpoint has been compromised. Using PGP to secure your messages relies heavily on **good OPSEC practices** and discipline.

> Never upload, paste, or send your private key or its passphrase to this site or any other. Keep the private key on a device you trust.

## How PGP messaging works, in general

A PGP encryption user generates a key pair, which consists of:
- A private key that **must remain secret**
- A public key that can be shared, for example on a profile page or website
- A fingerprint (a hash of the public key) that can be shared privately through a trusted channel so a person can verify the public key you have shared is yours
- A passphrase which adds some security to the private key

To communicate:

1. Each person creates a key pair
2. The participants exchange public keys, and through a separate, authenticated channel, fingerprints
3. The participants confirm the public keys provided were real by verifying against the supplied fingerprint
4. The sender encrypts a message with the recipient's public key. The result is ciphertext that can be stored or transported without revealing the message contents to anybody who intercepts it.
4. The recipient receives the encrypted cyphertext, unlocks their private key using their passphrase, and decrypts the message with it.

> The fingerprint verification step is technically optional, but operationally critical. Encryption establishes that only the holder of the matching private key can read the message but does not guarantee that the public key you have obtained has not been tampered with. Don't skip fingerprinting unless you were provided the public key by the recipient in-person or via a strongly trusted channel.
> 
> One example of a scenario where fingerprinting would protect against attack:
>
> A website has been compromised. It has a public key listed for the owner but has been replaced by one belonging to the attackers. The site's contact form has also been tampered with to send messages to them instead of the owner. If you reached out to the owner via a channel external to the website to exchange fingerprints - such as in person, by phone call, or any other platform that isn't compromised, you would see the fingerprint they provided does not match the public key and know the public key is untrustworthy. If you skipped fingerprinting, you would send your message encrypted against a key the attackers could decrypt, to an inbox they control. Encryption FAIL!

## How PGP messaging works here on latex.gg

1. A recipient registers their public PGP key. Before they can receive messages to it, they must verify they own the key by decrypting and entering a verification code the latex backend has encrypted using their key.
2. When a sender wants to composes a message, they obtain their recipient's public key and fingerprint through external channels (latex.gg does not reveal user's public keys to other users). Their browser / TUI app encrypts the message with the supplied key and warns if the fingerprint doesn't match.
3. Only the ASCII-armored PGP ciphertext is uploaded - neither the TUI nor the website transmit the message in plaintext anywhere. latex.gg stores and delivers only that ciphertext.
4. The recipient downloads the ciphertext of a received message with the latex TUI which decrypts it locally with their private key, or copies it from their browser and decrypts it manually. The TUI does not store received messages - it requires internet to latex.gg to view both new and previously received messages.
5. The inbox groups messages into conversations according to who sent them. Each sender is identified using a random, pairwise 32-character label. Different recipients see a different label even for the same sender, so it is not a public or global identity, it can **only** be used to group messages into threads for **that** recipient.

A compromised latex.gg database **can not** be used to decrypt the contents of any message - the private key is never held by latex.gg - but it **can** be used to identify which latex.gg account holder sent a message; if your account holds images or username / email information that you don't wish to be associated with even an encrypted message chain, don't use latex.gg to send your messages, or create a separate account for messaging.

The pairwise label hides account IDs from recipients and client APIs, but it is not a hash of the account ID and does not make the database unlinkable. The database currently stores the sender's account ID with each message and in the table that maps senders to thread labels. Someone with full database access can therefore link a stored message to its sending account. The label protects against correlation by other users, not against the service or a database compromise.

## What PGP does protect you from

- The message body is unreadable by anybody who doesn't have the recipient's private key
- A database or storage leak *should* expose only ciphertext rather than message plaintext

## What PGP does not protect you from

- **Future compromise:** encrypted messages do not have forward secrecy. Someone who later obtains your private key may decrypt ciphertext they saved earlier.
- **Metadata:** a service that observes the sender's account information, time, message size, IP address and other normal request data can learn a lot about you without knowing the message contents.
- **Compromised endpoints:** malware, a compromised latex.gg site, a hostile browser extension, a keylogger, screenshots or physical access to an unlocked device can reveal plaintext.
- **Public-key identity data:** OpenPGP public keys can contain names, email addresses and comments in User ID packets. Don't supply these when creating your key.

## Before sending a sensitive message

1. **Verify the full fingerprint out of band.** Compare all 40 hexadecimal characters over a separate, authenticated channel such as an in-person meeting, a known phone call or a previously verified account. Don't rely on a short key ID.
3. **Check the environment.** Use a trusted, updated device and browser. Avoid shared computers, public terminals, remote desktops and devices with unknown extensions. Avoid copy / pasting decrypted message content if you have a clipboard manager installed. If you don't trust your browser not to transmit or store your entered text, consider using sotware or binaries (such as the latex TUI) that you trust.
4. **Minimise what you disclose.** Do not include names, locations, schedules or other identifying context unless the recipient needs it. Message timing, frequency and size can still reveal patterns.
5. **Use another channel for high-risk coordination.** If metadata exposure or strong forward secrecy matters, choose a protocol designed for those goals.

## Protecting your private key

- Generate and store the key on a trusted device; never send it through chat, email, forms or support requests.
- Protect it with a strong, unique passphrase and keep the passphrase separate from exported key backups.
- Keep encrypted backups in physically separate, access-controlled locations. Test that you can restore them.
- Restrict file permissions and full-disk-encrypt every device and backup that contains the key.
- Lock the device when unattended and keep its operating system, browser and PGP software patched.
- Create and safely store a revocation certificate so you can revoke a lost or compromised key.
- If compromise is suspected, stop using the key, revoke it, notify contacts through a verified channel and replace it. Assume previously captured ciphertext may be readable.
- Consider storing your private key and performing decryption on an offline device.

## Receiving and decrypting

- Decrypt only on a trusted local device. Do not paste a private key or passphrase into a website to make decryption more convenient.
- Verify the expected fingerprint before trusting any reply key or replacement key.
- Treat decrypted files, clipboard contents, editor swap files, shell history, notifications and backups as plaintext. Clear or protect them according to your threat model.
- Remember that deleting a local plaintext copy does not guarantee secure erasure on modern storage, synced folders or backups.

## Quick checklist

- [ ] I verified the recipient's full fingerprint through a separate authenticated channel.
- [ ] I am using a trusted, updated device without untrusted extensions or remote access.
- [ ] My private key stays local and is protected by a strong passphrase and encrypted backups.
- [ ] The message contains only the information the recipient needs.
- [ ] I understand that the service still sees metadata and that these messages do not provide forward secrecy.
- [ ] For high-risk communication, I have considered a tool whose threat model matches that risk.
