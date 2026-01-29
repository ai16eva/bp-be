

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_CMD="0 2 * * * cd $PROJECT_DIR && node scripts/index_with_helius_das.js >> logs/nft-reindex.log 2>&1"

echo "Setting up cron job for NFT reindexing..."
echo ""
echo "Cron schedule: Every day at 2:00 AM"
echo "Script: $PROJECT_DIR/scripts/index_with_helius_das.js"
echo "Log: $PROJECT_DIR/logs/nft-reindex.log"
echo ""


mkdir -p "$PROJECT_DIR/logs"


if crontab -l 2>/dev/null | grep -q "index_with_helius_das.js"; then
    echo "⚠️  Cron job already exists!"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "index_with_helius_das.js"
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    crontab -l | grep -v "index_with_helius_das.js" | crontab -
fi

(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "✅ Cron job installed successfully!"
echo ""
echo "To verify:"
echo "  crontab -l"
echo ""
echo "To remove:"
echo "  crontab -e"
echo "  # Delete the line with 'index_with_helius_das.js'"
echo ""
echo "To test manually:"
echo "  node scripts/index_with_helius_das.js"
