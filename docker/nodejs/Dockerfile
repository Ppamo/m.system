FROM ppamo.cl/devel:latest
MAINTAINER "Ppamo" <pablo@ppamo.cl>

# install nodejs by installing npm
RUN yum install -y npm

# expose m.system control port
EXPOSE 1234

# start sshd
CMD ["/usr/sbin/sshd", "-D"]
