FROM httpd:2.4

RUN echo "\
LoadModule proxy_module modules/mod_proxy.so\n\
LoadModule proxy_http_module modules/mod_proxy_http.so\n\
ProxyPass /api http://rest-api:8008\n\
ProxyPassReverse /api http://rest-api:8008\n\
RequestHeader set X-Forwarded-Path \"/api\"\n\
Header append Access-Control-Allow-Origin \"*\"\n\
Header set Allow OPTIONS,GET,HEAD,POST\n\
" >>/usr/local/apache2/conf/httpd.conf