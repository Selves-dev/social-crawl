#!/bin/bash

# Setup Azure Service Bus Queues
# This script creates the required queues in the specified Service Bus namespace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first:"
        echo "  brew install azure-cli"
        echo "  # or"
        echo "  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
        exit 1
    fi
}

# Function to check if user is logged in to Azure
check_azure_login() {
    if ! az account show &> /dev/null; then
        print_error "You are not logged in to Azure. Please run:"
        echo "  az login"
        exit 1
    fi
}

# Function to create a Service Bus queue
create_queue() {
    local namespace=$1
    local queue_name=$2
    local resource_group=$3
    
    print_status "Creating queue '$queue_name' in namespace '$namespace'..."
    
    # Check if queue already exists
    if az servicebus queue show --namespace-name "$namespace" --name "$queue_name" --resource-group "$resource_group" &> /dev/null; then
        print_warning "Queue '$queue_name' already exists in namespace '$namespace'"
        return 0
    fi
    
    # Create the queue
    if az servicebus queue create \
        --namespace-name "$namespace" \
        --name "$queue_name" \
        --resource-group "$resource_group" \
        --max-size 1024 \
        --default-message-time-to-live P14D \
        --lock-duration PT30S \
        --enable-duplicate-detection false \
        --enable-session false \
        --output none; then
        print_success "Created queue '$queue_name'"
    else
        print_error "Failed to create queue '$queue_name'"
        return 1
    fi
}

# Function to setup queues for a namespace
setup_namespace_queues() {
    local namespace=$1
    local resource_group=$2
    local env_name=$3
    
    print_status "Setting up queues for $env_name environment (namespace: $namespace)"
    
    # Required queues
    local queues=("post-office" "prep-media" "ai-service")
    
    for queue in "${queues[@]}"; do
        create_queue "$namespace" "$queue" "$resource_group"
    done
    
    print_success "All queues created for $env_name environment"
}

# Function to display usage
usage() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  local       Setup queues for local development (taash-local namespace)"
    echo "  production  Setup queues for production (taash-social-crawler namespace)"
    echo "  all         Setup queues for both environments"
    echo ""
    echo "Examples:"
    echo "  $0 local"
    echo "  $0 production"
    echo "  $0 all"
    echo ""
    echo "Prerequisites:"
    echo "  - Azure CLI installed and logged in"
    echo "  - Access to the Azure subscription containing the Service Bus namespaces"
}

# Main script
main() {
    local environment=${1:-""}
    
    if [[ -z "$environment" ]]; then
        usage
        exit 1
    fi
    
    print_status "🚀 Setting up Azure Service Bus queues for Social Crawl"
    
    # Check prerequisites
    check_azure_cli
    check_azure_login
    
    # Get current subscription
    local subscription=$(az account show --query name -o tsv)
    print_status "Using Azure subscription: $subscription"
    
    # Resource group (assuming same for both namespaces)
    local resource_group="social-crawler-rg"
    
    case "$environment" in
        "local")
            setup_namespace_queues "taash-local" "$resource_group" "local"
            ;;
        "production")
            setup_namespace_queues "taash-social-crawler" "$resource_group" "production"
            ;;
        "all")
            setup_namespace_queues "taash-local" "$resource_group" "local"
            echo ""
            setup_namespace_queues "taash-social-crawler" "$resource_group" "production"
            ;;
        *)
            print_error "Invalid environment: $environment"
            usage
            exit 1
            ;;
    esac
    
    echo ""
    print_success "✅ Queue setup completed!"
    
    # Display next steps
    echo ""
    print_status "Next steps:"
    echo "  • Queues are ready for use"
    echo "  • Start your application to begin processing messages"
    echo "  • Monitor queue metrics in Azure Portal"
}

# Run main function with all arguments
main "$@"
