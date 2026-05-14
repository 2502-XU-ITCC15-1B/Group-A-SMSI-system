FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the static HTML, CSS, and JS files to the nginx html directory
COPY . /usr/share/nginx/html

# Use Render runtime API host config and static file routing
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80 inside the container
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
