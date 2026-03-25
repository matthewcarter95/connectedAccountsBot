# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**connectedAccountsBot** is a Discord bot that bridges Google Email with Discord channels. The bot monitors Google Email events and sends notifications to designated Discord channels.

## Current Status

This is an early-stage project. Currently only infrastructure files (`.gitignore`) exist. The codebase needs to be initialized with:

- Package configuration (`package.json`)
- TypeScript configuration (`tsconfig.json`)
- Source code implementation
- Environment configuration (`.env.example`)
- Discord bot setup with Discord.js
- Google Email API integration

## Planned Technology Stack

Based on the `.gitignore` configuration, this project is set up for:

- **Runtime:** Node.js
- **Language:** TypeScript
- **Build Tool:** Vite
- **Primary Integrations:**
  - Discord.js for Discord bot functionality
  - Google APIs for Gmail/email access

## Expected Architecture

When implemented, the bot will consist of:

1. **Google Email Monitor:** Listens for Gmail events using Google APIs
2. **Event Processor:** Transforms email events into Discord messages
3. **Discord Client:** Maintains connection to Discord and sends messages to channels
4. **Configuration:** Manages credentials, channel mappings, and filter rules

## Development Commands

Once the project is initialized, standard commands will likely include:

```bash
npm install          # Install dependencies
npm run dev          # Start development mode
npm run build        # Build for production
npm run lint         # Run ESLint
npm test             # Run tests
npm start            # Start the bot
```

## Environment Configuration

The bot will require environment variables for:

- Discord bot token
- Discord channel IDs
- Google API credentials (OAuth2 or service account)
- Gmail account to monitor

These should be stored in a `.env` file (not committed) with a `.env.example` template provided.
