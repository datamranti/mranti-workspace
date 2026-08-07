# MRANTI Workspace — BrainT Checkpoint 1

This frontend release establishes the approved BrainT product foundation while preserving the existing production integrations.

## Included

- Approved MRANTI Workspace sign-in experience retained
- Authenticated header with MRANTI 30 logo, divider and BrainT icon only
- Premium Home and Chats navigation rail
- Animated BrainT orb with idle, thinking, responding, complete and error states
- Clean home composer with one Workspace attachment control
- Live response layout with grounded answer, real structured output and sources when returned by the backend
- Firestore conversation history and existing n8n service integration retained
- Responsive desktop and mobile layouts

## Production rules

- Production mode is enabled
- Mock-data fallback is disabled
- The frontend renders structured cards only from fields returned by the live service
- No example conversations, fabricated metrics or decorative dead controls are shipped
- The Gemini credential remains in n8n and is not exposed in this frontend

## Deployment

Replace the current site files with the complete contents of this package. No Firebase, Firestore or n8n workflow change is required for Checkpoint 1.

See `CHECKPOINT_1_RELEASE_NOTES.md` for the verified scope and test record. Existing environment setup information remains in `PRODUCTION_SETUP.md`.
