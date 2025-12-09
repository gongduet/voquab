#!/bin/bash
# Batch import multiple chapters
#
# Usage:
#   ./scripts/batch_import_chapters.sh START_CHAPTER END_CHAPTER
#
# Example:
#   ./scripts/batch_import_chapters.sh 3 10
#
# This script will:
# 1. Check that chapter files exist
# 2. Import each chapter using import_chapter.py
# 3. Run phrase detection for each chapter
# 4. Provide a summary at the end

set -e  # Exit on any error

if [ "$#" -lt 2 ]; then
    echo "Usage: ./scripts/batch_import_chapters.sh START_CHAPTER END_CHAPTER"
    echo ""
    echo "Examples:"
    echo "  ./scripts/batch_import_chapters.sh 3 10     # Import chapters 3-10"
    echo "  ./scripts/batch_import_chapters.sh 11 20    # Import chapters 11-20"
    echo ""
    echo "Make sure to split combined chapter files first:"
    echo "  python3 scripts/split_chapters.py --input data/chapters-X-Y-spanish.txt --chapters X-Y"
    exit 1
fi

START=$1
END=$2

echo "=========================================="
echo "BATCH IMPORT: Chapters $START to $END"
echo "=========================================="
echo ""

# First, check all files exist
echo "Checking chapter files..."
MISSING=0
for i in $(seq $START $END); do
    if [ ! -f "data/chapter${i}-spanish.txt" ]; then
        echo "  ✗ Missing: data/chapter${i}-spanish.txt"
        MISSING=1
    else
        echo "  ✓ Found: data/chapter${i}-spanish.txt"
    fi
done

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "ERROR: Some chapter files are missing!"
    echo "Run split_chapters.py first to create them."
    exit 1
fi

echo ""
echo "All chapter files found. Starting import..."
echo ""

# Track results
IMPORTED=0
FAILED=0

for i in $(seq $START $END); do
    echo ""
    echo "=========================================="
    echo "CHAPTER $i"
    echo "=========================================="

    # Step 1: Import chapter (sentences, words, lemmas, translations)
    echo "--- Step 1: Importing content ---"
    if python3 scripts/import_chapter.py \
        --chapter $i \
        --input data/chapter${i}-spanish.txt; then

        echo "✓ Chapter $i content imported"

        # Step 2: Run phrase detection (separate call)
        echo ""
        echo "--- Step 2: Detecting phrases ---"
        if python3 scripts/import_chapter.py \
            --detect-phrases \
            --chapter $i; then
            echo "✓ Chapter $i phrases detected"
        else
            echo "⚠ Chapter $i phrase detection had issues (continuing)"
        fi

        IMPORTED=$((IMPORTED + 1))
        echo ""
        echo "✓ Chapter $i complete"
    else
        echo "✗ Chapter $i import FAILED"
        FAILED=$((FAILED + 1))

        # Ask whether to continue
        read -p "Continue with remaining chapters? (y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ]; then
            echo "Aborting batch import."
            exit 1
        fi
    fi
done

echo ""
echo "=========================================="
echo "BATCH IMPORT COMPLETE"
echo "=========================================="
echo ""
echo "Results:"
echo "  ✓ Imported: $IMPORTED chapters"
if [ $FAILED -gt 0 ]; then
    echo "  ✗ Failed: $FAILED chapters"
fi
echo ""
echo "Next steps:"
echo "1. Review phrases for each chapter:"
echo "   python3 scripts/import_chapter.py --show-phrases --chapter N"
echo ""
echo "2. Run AI validation on all chapters:"
echo "   for i in \$(seq $START $END); do"
echo "     python3 scripts/import_chapter.py --validate-ai --chapter \$i"
echo "   done"
echo ""
echo "3. Check quality metrics:"
echo "   python3 scripts/import_chapter.py --quality-check"
