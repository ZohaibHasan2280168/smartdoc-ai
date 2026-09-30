#!/usr/bin/env bash
# =============================================================================
# DevOps Environment One-Click Bootstrap Script
# Installs Ansible (if missing) and executes setup_all_devops_dependencies.yml
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAYBOOK="${SCRIPT_DIR}/ansible/setup_all_devops_dependencies.yml"

echo "=========================================================="
echo "  🚀 Starting SmartDoc AI DevOps Dependencies Setup"
echo "=========================================================="

# Check if running with sudo / root
if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
    echo "[*] Non-root user detected. sudo will be requested."
else
    SUDO=""
fi

# 1. Ensure Ansible is installed
if ! command -v ansible &> /dev/null; then
    echo "[*] Ansible is not installed. Installing Ansible via apt..."
    $SUDO apt-get update -y
    $SUDO apt-get install -y ansible
else
    echo "[✓] Ansible is already installed: $(ansible --version | head -n 1)"
fi

# 2. Execute the Ansible Playbook
echo "[*] Running Ansible Playbook: ${PLAYBOOK}..."
if [ -n "$SUDO" ]; then
    ansible-playbook -i localhost, -c local "${PLAYBOOK}" --ask-become-pass
else
    ansible-playbook -i localhost, -c local "${PLAYBOOK}"
fi

echo "=========================================================="
echo "  🎉 All DevOps Dependencies Successfully Installed!"
echo "  Note: Run 'newgrp docker' or log out and back in to apply"
echo "        docker group permissions without sudo."
echo "=========================================================="
