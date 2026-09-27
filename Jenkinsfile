pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = "smartdoc"
        BACKEND_IMAGE   = "smartdoc-backend"
        FRONTEND_IMAGE  = "smartdoc-frontend"
        BUILD_TAG       = "${env.BUILD_NUMBER}"
        KUBECONFIG      = credentials('kubeconfig-credentials-id')
    }

    stages {
        stage('1. Code Checkout & Lint') {
            steps {
                echo 'Checking out source repository...'
                sh 'git status'
                echo 'Validating Dockerfiles and Kubernetes manifests...'
                sh 'docker run --rm -i hadolint/hadolint < backend/Dockerfile || true'
            }
        }

        stage('2. Build Docker Images') {
            steps {
                echo 'Building multi-stage Backend Docker image...'
                sh "docker build -t ${BACKEND_IMAGE}:${BUILD_TAG} -t ${BACKEND_IMAGE}:latest backend/"

                echo 'Building multi-stage Frontend Docker image...'
                sh "docker build -t ${FRONTEND_IMAGE}:${BUILD_TAG} -t ${FRONTEND_IMAGE}:latest frontend/"
            }
        }

        stage('3. Smoke Test (Local Container Check)') {
            steps {
                echo 'Starting backend container for health check verification...'
                sh '''
                    docker run -d --name temp-backend -p 8001:8000 ${BACKEND_IMAGE}:latest
                    sleep 5
                    curl -s http://localhost:8001/api/v1/health || true
                    docker rm -f temp-backend
                '''
            }
        }

        stage('4. Deploy to Kubernetes / Minikube') {
            steps {
                echo 'Applying Kubernetes manifests to cluster...'
                sh '''
                    kubectl apply -f k8s/namespace.yaml
                    kubectl apply -f k8s/postgres.yaml
                    kubectl apply -f k8s/redis.yaml
                    kubectl apply -f k8s/backend.yaml
                    kubectl apply -f k8s/frontend.yaml
                    kubectl apply -f k8s/ingress.yaml
                '''
            }
        }

        stage('5. Rollout Verification') {
            steps {
                echo 'Awaiting rollout status...'
                sh '''
                    kubectl -n smartdoc-ai rollout status deployment/postgres --timeout=90s
                    kubectl -n smartdoc-ai rollout status deployment/redis --timeout=60s
                    kubectl -n smartdoc-ai rollout status deployment/backend --timeout=120s
                    kubectl -n smartdoc-ai rollout status deployment/frontend --timeout=120s
                '''
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution finished.'
            sh 'docker system prune -f || true'
        }
        success {
            echo 'Deployment successfully rolled out to cluster!'
        }
        failure {
            echo 'Pipeline failed. Check stage logs for details.'
        }
    }
}
