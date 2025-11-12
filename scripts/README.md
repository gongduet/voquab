# Translation Scripts

This directory contains scripts for translating book chapters from Spanish to English using the Google Cloud Translation API.

## Setup

### 1. Google Cloud Translation API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Cloud Translation API
4. Create a service account key:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Grant it the "Cloud Translation API User" role
   - Create and download a JSON key file

### 2. Set Environment Variable

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your credentials file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"
```

To make this permanent, add it to your `~/.bashrc` or `~/.zshrc`:

```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"' >> ~/.bashrc
source ~/.bashrc
```

## Usage

### translate-chapter.js

Translates a Spanish text file to English, splitting it into sentences and outputting structured JSON.

**Command:**
```bash
npm run translate <input-file> <chapter-number> [output-file]
```

**Arguments:**
- `input-file` - Path to the Spanish text file
- `chapter-number` - Chapter number (integer)
- `output-file` - (Optional) Path to output JSON file. Default: `chapter-<number>-translated.json`

**Examples:**

```bash
# Translate chapter 1
npm run translate data/chapter1.txt 1

# Translate chapter 1 with custom output file
npm run translate data/chapter1.txt 1 output/chapter1.json

# Direct node usage
node scripts/translate-chapter.js data/chapter1.txt 1
```

**Output Format:**

The script outputs JSON in this format:

```json
{
  "chapter_number": 1,
  "sentences": [
    {
      "order": 1,
      "spanish": "Cuando yo tenía seis años vi una vez una lámina magnífica.",
      "english": "When I was six years old I once saw a magnificent picture."
    },
    {
      "order": 2,
      "spanish": "Representaba una serpiente boa comiéndose a una fiera.",
      "english": "It represented a boa constrictor eating a wild animal."
    }
  ]
}
```

## Features

### Smart Sentence Splitting

The script properly handles:
- Spanish abbreviations (Sr., Sra., Dr., etc.)
- Numbers with decimals (3.14, 10.5)
- Ellipsis (...)
- Common edge cases

### Error Handling

- Gracefully handles translation failures
- Adds delay between requests to avoid rate limits
- Provides detailed progress logging

## Troubleshooting

**Error: "Error initializing Google Cloud Translate client"**
- Make sure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify the credentials file exists and is valid JSON

**Error: "The caller does not have permission"**
- Ensure the Cloud Translation API is enabled in your Google Cloud project
- Verify your service account has the "Cloud Translation API User" role

**Rate limit errors**
- The script includes a 100ms delay between translations
- You can increase this in the code if needed
- Check your Google Cloud quota limits
