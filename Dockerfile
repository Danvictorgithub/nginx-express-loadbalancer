FROM nginx:latest

# Copy custom NGINX configuration file to the container
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports 80 and 443
EXPOSE 443
