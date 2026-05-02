FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the static HTML, CSS, and JS files to the nginx html directory
COPY . /usr/share/nginx/html

# Expose port 80 inside the container
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]