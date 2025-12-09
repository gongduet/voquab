#!/usr/bin/env python3
"""
Split combined chapter files into individual chapter files.

Usage:
    python3 scripts/split_chapters.py --input data/chapters-2-10-spanish.txt --chapters 2-10
    python3 scripts/split_chapters.py --input data/chapters-11-20-spanish.txt --chapters 11-20
    python3 scripts/split_chapters.py --input data/chapters-21-27-spanish.txt --chapters 21-27
"""

import re
import argparse
from pathlib import Path


def roman_to_int(roman: str) -> int:
    """Convert Roman numeral to integer."""
    roman_values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    total = 0
    prev_value = 0

    for char in reversed(roman.upper()):
        value = roman_values.get(char, 0)
        if value >= prev_value:
            total += value
        else:
            total -= value
        prev_value = value

    return total


def split_chapters(input_file: str, chapter_range: str, output_dir: str = 'data') -> bool:
    """
    Split combined chapter file into individual files.

    Handles the format where chapters are separated by "Capítulo N" markers
    that may appear inline (not on separate lines).

    Args:
        input_file: Path to combined chapter file
        chapter_range: String like "2-10" or "11-20"
        output_dir: Directory to save individual chapter files

    Returns:
        True if successful, False otherwise
    """

    input_path = Path(input_file)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_file}")
        return False

    # Read input file
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Parse expected range
    start_ch, end_ch = map(int, chapter_range.split('-'))
    expected_chapters = list(range(start_ch, end_ch + 1))

    print(f"Looking for chapters {start_ch} to {end_ch}...")

    # Find all chapter markers: "Capítulo N" or "Capítulo N " (with Arabic or Roman numerals)
    # Pattern matches "Capítulo" followed by number (Arabic or Roman)
    pattern = r'Cap[ií]tulo\s+(\d+|[IVXLCDM]+)\s*'

    matches = list(re.finditer(pattern, content, re.IGNORECASE))

    if not matches:
        print(f"ERROR: No chapter markers found in {input_file}")
        print("Expected pattern: 'Capítulo N' or 'Capítulo III'")
        return False

    # Extract chapter info from matches
    chapters_found = []
    for match in matches:
        chapter_marker = match.group(1)
        if chapter_marker.isdigit():
            chapter_num = int(chapter_marker)
        else:
            chapter_num = roman_to_int(chapter_marker)

        chapters_found.append({
            'chapter_number': chapter_num,
            'start_pos': match.end(),  # Content starts after the marker
            'marker_text': match.group(0).strip()
        })

    print(f"Found {len(chapters_found)} chapter markers:")
    for ch in chapters_found:
        print(f"  Chapter {ch['chapter_number']}: '{ch['marker_text']}'")

    # Verify we found all expected chapters
    found_nums = [ch['chapter_number'] for ch in chapters_found]
    missing = set(expected_chapters) - set(found_nums)

    if missing:
        print(f"\nWARNING: Missing chapters: {sorted(missing)}")
        proceed = input("Continue anyway? (y/n): ")
        if proceed.lower() != 'y':
            return False

    # Filter to only chapters in the expected range and sort
    chapters_found = [ch for ch in chapters_found if ch['chapter_number'] in expected_chapters]
    chapters_found.sort(key=lambda x: x['chapter_number'])

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    created_files = []

    # Split and save each chapter
    for i, ch in enumerate(chapters_found):
        chapter_num = ch['chapter_number']
        start_pos = ch['start_pos']

        # End position is either the next chapter's marker start, or end of file
        if i + 1 < len(chapters_found):
            # Find the match that corresponds to the next chapter
            next_ch = chapters_found[i + 1]
            # We need to find where the marker for the next chapter starts
            # Search backwards from next chapter's content start
            next_marker_pattern = rf'Cap[ií]tulo\s+{next_ch["chapter_number"]}\s*'
            next_match = re.search(next_marker_pattern, content[start_pos:], re.IGNORECASE)
            if next_match:
                end_pos = start_pos + next_match.start()
            else:
                end_pos = next_ch['start_pos'] - len(next_ch['marker_text']) - 10  # Approximate
        else:
            end_pos = len(content)

        # Extract chapter content
        chapter_content = content[start_pos:end_pos].strip()

        # Clean up any trailing/leading whitespace
        chapter_content = chapter_content.strip()

        # Save to file
        output_file = output_path / f"chapter{chapter_num}-spanish.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(chapter_content)

        word_count = len(chapter_content.split())
        char_count = len(chapter_content)
        print(f"✓ Created {output_file} (~{word_count} words, {char_count} chars)")
        created_files.append((output_file, chapter_num))

    # Verify files
    print(f"\n--- Verification ---")
    for output_file, chapter_num in created_files:
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
        first_words = ' '.join(content.split()[:10])
        print(f"Chapter {chapter_num}: \"{first_words}...\"")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='Split combined chapter file into individual files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 scripts/split_chapters.py --input data/chapters-2-10-spanish.txt --chapters 2-10
    python3 scripts/split_chapters.py --input data/chapters-11-20-spanish.txt --chapters 11-20
    python3 scripts/split_chapters.py --input data/chapters-21-27-spanish.txt --chapters 21-27
        """
    )
    parser.add_argument('--input', required=True, help='Combined chapter file')
    parser.add_argument('--chapters', required=True, help='Chapter range (e.g., "2-10")')
    parser.add_argument('--output-dir', default='data', help='Output directory (default: data)')

    args = parser.parse_args()

    success = split_chapters(args.input, args.chapters, args.output_dir)

    if success:
        print("\n✓ Chapter splitting complete!")
        print(f"\nNext step: Import chapters using:")
        print(f"  python3 scripts/import_chapter.py --chapter N --input data/chapterN-spanish.txt")
    else:
        print("\n✗ Chapter splitting failed")
        exit(1)


if __name__ == '__main__':
    main()
