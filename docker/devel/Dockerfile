FROM centos:centos7
MAINTAINER "Ppamo" <pablo@ppamo.cl>

# install and setup ssh
RUN yum install -y openssh-server passwd ; \
	ssh-keygen -q -t rsa -f /etc/ssh/ssh_host_rsa_key -C '' -N '' ; \
	ssh-keygen -q -t dsa -f /etc/ssh/ssh_host_dsa_key -C '' -N '' ; \
	rm -f /var/run/nologin

# create and setup devel user
RUN useradd devel && echo -e "123123" | (passwd --stdin devel)

# setup sudo
RUN yum -y install sudo ; \
	echo "devel ALL=NOPASSWD: ALL" >> /etc/sudoers ; \
	sed -i 's/Defaults   !visiblepw//g'  /etc/sudoers ; \
	sed -i 's/Defaults    requiretty//g'  /etc/sudoers

# install devel tools
RUN yum install -y epel-release git vim

# expose ssh and start sshd
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
