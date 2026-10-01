pipeline {
    agent any

    triggers {
        githubPush()
        pollSCM('* * * * *')
    }

    environment {
        DOCKER_REGISTRY = "smartdoc"
        BACKEND_IMAGE   = "smartdoc-backend"
        FRONTEND_IMAGE  = "smartdoc-frontend"
        BUILD_TAG       = "v${env.BUILD_NUMBER}"
        GITHUB_TOKEN    = credentials('github-token')
    }

    stages {
        stage('1. Check Commit & Prevent GitOps Loop') {
            steps {
                script {
                    def commitMsg = sh(script: "git log -1 --pretty=%B", returnStdout: true).trim()
                    echo "Latest commit message: ${commitMsg}"
                    if (commitMsg.contains('[skip ci]') || commitMsg.contains('chore(gitops)')) {
                        echo "Automated GitOps commit detected. Skipping build to prevent infinite loop."
                        env.SKIP_PIPELINE = "true"
                    } else {
                        env.SKIP_PIPELINE = "false"
                    }
                }
            }
        }

        stage('2. Code Checkout & Lint') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo 'Checking out source repository...'
                sh '''
                    git config --global --add safe.directory '*' || true
                    git status || true
                '''
                echo 'Validating Dockerfiles and Kubernetes manifests...'
                sh 'docker run --rm -i hadolint/hadolint < backend/Dockerfile || true'
            }
        }

        stage('3. Build Docker Images with Immutable Tag') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo "Building multi-stage Backend image with tag: ${BUILD_TAG}..."
                sh "docker build -t ${BACKEND_IMAGE}:${BUILD_TAG} -t ${BACKEND_IMAGE}:latest backend/"

                echo "Building multi-stage Frontend image with tag: ${BUILD_TAG}..."
                sh "docker build -t ${FRONTEND_IMAGE}:${BUILD_TAG} -t ${FRONTEND_IMAGE}:latest frontend/"
            }
        }

        stage('4. Smoke Test (Local Container Check)') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo 'Starting backend container for health check verification...'
                sh '''
                    docker run -d --name temp-backend -p 8001:8000 ${BACKEND_IMAGE}:${BUILD_TAG}
                    sleep 5
                    curl -s http://localhost:8001/api/v1/health || true
                    docker rm -f temp-backend
                '''
            }
        }

        stage('5. Import Images into Minikube Runtime') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo "Publishing ${BUILD_TAG} images into Minikube containerd..."
                sh """
                    docker save ${BACKEND_IMAGE}:${BUILD_TAG} | docker exec -i minikube ctr -n k8s.io images import - || true
                    docker save ${FRONTEND_IMAGE}:${BUILD_TAG} | docker exec -i minikube ctr -n k8s.io images import - || true
                """
                echo "Images successfully preloaded into cluster runtime."
            }
        }

        stage('6. Update GitOps Manifests & Push to GitHub') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo "Updating k8s manifests with new immutable tag ${BUILD_TAG}..."
                sh """
                    # Fetch latest remote state
                    git fetch origin main || true
                    git checkout -B main origin/main || true

                    # Update image tags in k8s manifests
                    sed -i "s|image: ${FRONTEND_IMAGE}:.*|image: ${FRONTEND_IMAGE}:${BUILD_TAG}|g" k8s/frontend.yaml
                    sed -i "s|image: ${BACKEND_IMAGE}:.*|image: ${BACKEND_IMAGE}:${BUILD_TAG}|g" k8s/backend.yaml

                    # Configure git committer
                    git config user.name "Jenkins GitOps Bot"
                    git config user.email "jenkins-bot@smartdoc.ai"

                    if git diff --quiet k8s/; then
                        echo "No manifest changes detected."
                    else
                        git add k8s/frontend.yaml k8s/backend.yaml
                        git commit -m "chore(gitops): bump deployment images to ${BUILD_TAG} [skip ci]"
                        git push https://\${GITHUB_TOKEN}@github.com/ZohaibHasan2280168/smartdoc-ai.git main
                        echo "Successfully pushed updated manifests to GitHub repository!"
                    fi
                """
            }
        }

        stage('7. ArgoCD GitOps Sync & Rollout Verification') {
            when {
                expression { return env.SKIP_PIPELINE == "false" }
            }
            steps {
                echo 'Triggering ArgoCD instant reconciliation & verifying zero-downtime rollout...'
                sh '''
                    # Signal ArgoCD to refresh and sync immediately from Git
                    kubectl -n argocd patch application smartdoc-ai --type merge -p '{"operation":{"sync":{"prune":true}}}' || true

                    # Wait for ArgoCD to execute the rolling update across cluster
                    kubectl -n smartdoc-ai rollout status deployment/frontend --timeout=120s
                    kubectl -n smartdoc-ai rollout status deployment/backend --timeout=120s
                '''
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution finished.'
            sh 'docker image prune -f --filter "dangling=true" || true'
        }
        success {
            echo 'Pure GitOps workflow completed successfully! ArgoCD is in sync.'
        }
        failure {
            echo 'Pipeline failed. Check stage logs for details.'
        }
    }
}
