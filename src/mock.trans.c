#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <netdb.h>
#include <fcntl.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h> 
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/socket.h>
#include <sys/sendfile.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <openssl/md5.h>

#define BUFFERSIZE 1024

struct shared_data {
	int recording;
	char stage[32];
	time_t update_time;
	pid_t pid;
};

char *str2md5(const char *str, int length) {
	int n;
	MD5_CTX c;
	unsigned char digest[16];
	char *out = (char*)malloc(33);

	MD5_Init(&c);

	while (length > 0) {
		if (length > 512) {
			MD5_Update(&c, str, 512);
		} else {
			MD5_Update(&c, str, length);
		}
		length -= 512;
		str += 512;
	}

	MD5_Final(digest, &c);

	for (n = 0; n < 16; ++n) {
		snprintf(&(out[n*2]), 16*2, "%02x", (unsigned int)digest[n]);
	}

    return out;
}

void error(char *msg, FILE *fd_log) {
	if (fd_log == NULL) {
		perror(msg);
	} else {
		fprintf(fd_log, "%s\n", msg);
		fclose(fd_log);
	}
	exit(1);
}

void debug(FILE *fd, int connection_counter, char *msg){
	time_t now;
	time(&now);
	char buffer[100];
	strftime (buffer, 100, "%Y-%m-%d %H:%M:%S.000", localtime (&now));

	if (connection_counter != -1){
		fprintf(fd, "%s - [%i]: %s\n", buffer, connection_counter, msg);
	}
	else {
		fprintf(fd, "%s - %s\n", buffer, msg);
	}
	fflush(fd);
}

int ensure_file_path(char *file_path){
	char command[256];
	sprintf(command, "mkdir -p $(dirname %s)", file_path);
	system(command);
}

int is_eom(char *message){
	if (strlen(message) == 4){
		if (strstr(message, "end\n") != NULL){
			return 1;
		}
	}
	if (strstr(message, "\nend\0") != NULL){
		return 1;
	}
	return 0;
}

struct shared_data *get_shmem(const char *base_path){
	key_t key;
	int shmid;
	struct shared_data *data_ptr;

	if ((key = ftok(base_path, 'R')) == -1) {
		error("ERROR creating shared memmory key", NULL);
	}

	if ((shmid = shmget(key, sizeof(struct shared_data), 0644 | IPC_CREAT)) == -1) {
		error("ERROR getting the shared memmory", NULL);
	}

	data_ptr = (struct shared_data *)shmat(shmid, (void *)0, 0);
	if (data_ptr == (struct shared_data *)(-1)) {
		error("ERROR attaching to shared memmory segment", NULL);
	}

	return data_ptr;
}

void list_config(struct shared_data *data){
	struct tm *timeinfo;
	timeinfo = localtime(&(data->update_time));
	printf("=> pid: %d\n", data->pid);
	if (data->recording){
		printf("=> mode: record\n");
	} else {
		printf("=> mode: play\n");
	}
	printf("=> stage: %s\n", data->stage);
	printf("=> update time: %s", asctime(timeinfo));
}

void set_default_config (struct shared_data *data) {
	strcpy(data->stage, str2md5("default", 7));
	data->recording = 0;
	data->update_time = time(NULL);
	list_config(data);
}

void set_stage(struct shared_data *data, char value[100]){
	strcpy(data->stage, str2md5(value, strlen(value)));
	data->update_time = time(NULL);
	list_config(data);
} 

void set_pid(struct shared_data *data, pid_t pid){
	data->pid = pid;
}

void stop_server(struct shared_data *data){
	if (data->pid > 0){
		kill(data->pid, SIGQUIT);
		data->pid = 0;
		data->update_time = time(NULL);
	}
}

void set_mode(struct shared_data *data, char value[20]){
	if (strcmp(value, "play") == 0){
		data->recording = 0;
	} else if (strcmp(value, "record") == 0){
		data->recording = 1;
	} else {
		error("ERROR unknown mode", NULL);
	}
	data->update_time = time(NULL);
	list_config(data);
} 

int main(int argc, char **argv) {
	int optval = 1, n, reading = 1, connection_counter;
	int fd_parent, fd_child, fd_trans, fd_dump, clientlen;
	off_t sendfile_offset;
	struct sockaddr_in server_addr, client_addr, trans_addr;
	struct hostent *hostp, *trans;
	struct stat stat_buf;
	char buffer_in[BUFFERSIZE], buffer_out[BUFFERSIZE], file_path[128];
	char *hostaddrp, *trans_host;
	FILE *fd_in, *fd_out, *fd_log;
	int mock_port, trans_port;
	pid_t process_id = 0;

	const char *base_path=getenv("HOME");
	struct shared_data *shmem_data = get_shmem(base_path);

	// arguments list
	// set stage "stage name"
	// set mode [play|record]
	// get config
	// server "port" "trans host" "trans port"
	// stop
	
	if (argc > 1){
		if (strcmp(argv[1], "server") == 0){
			if (argc == 5){
				if (shmem_data->pid == 0){
					mock_port = atoi(argv[2]);
					trans_host = argv[3];
					trans_port = atoi(argv[4]);
					shmem_data->recording = 1;
					printf("0> tunnel: %i:%s:%i\n", mock_port, trans_host, trans_port);
				} else {
					error("ERROR server seems to be already running", NULL);
				}
			}
			else if (argc == 3){
				mock_port = atoi(argv[2]);
				shmem_data->recording = 0;
				printf("0> player: %i\n", mock_port);
			}
			else {
				error("ERROR wrong number of parameter for server", NULL);
			}
		}
		else if (strcmp(argv[1], "set") == 0){
			if (argc == 4){
				if (strcmp(argv[2], "stage") == 0){
					set_stage(shmem_data, argv[3]);
				} else if (strcmp(argv[2], "mode") == 0){
					set_mode(shmem_data, argv[3]);
				} else {
					error("ERROR unknown variable to set", NULL);
				}
			} else {
				error("ERROR wrong number of parameter for set", NULL);
			}

			exit (0);
		}
		else if (strcmp(argv[1], "get") == 0){
			if (argc == 3 && strcmp(argv[2], "config") == 0){
				list_config(shmem_data);
			} else {
				error("ERROR unknown param for get", NULL);
			}
			exit (0);
		}
		else if (strcmp(argv[1], "stop") == 0){
			stop_server(shmem_data);
			exit (0);
		}
		else {
			error("0> ERROR command not found", NULL);
		}
	}
	else {
		error("0> ERROR not enough parameters", NULL);
	}

	// XXX: fork and daemonization
	process_id = fork();
	if (process_id < 0){
		error("0> ERROR fork failed!", NULL);
	}
	if (process_id > 0){
		printf ("Killing parent process\n");
		exit(0);
	}
	// get child pid
	set_pid(shmem_data, getpid());

	// create log file
	fd_log = fopen("mock.log", "a");
	if (fd_log == NULL){
		error("ERROR fail to open log file", NULL);
	}

	// daemonization stuff
	/*
	umask(0);
	setsid();
	close(STDIN_FILENO);
	close(STDOUT_FILENO);
	close(STDERR_FILENO);
	*/


	fd_parent = socket(AF_INET, SOCK_STREAM, 0);
	if (fd_parent < 0) {
		error("0> ERROR opening socket", fd_log);
	}
	debug(fd_log, -1, "Starting!");

	setsockopt(fd_parent, SOL_SOCKET, SO_REUSEADDR, (const void *)&optval , sizeof(int));
	bzero((char *) &server_addr, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
	server_addr.sin_port = htons((unsigned short)mock_port);

	if (bind(fd_parent, (struct sockaddr *) &server_addr, sizeof(server_addr)) < 0) {
		error("0> ERROR on binding", fd_log);
	}
	if (listen(fd_parent, 5) < 0){
		error("0> ERROR on listen", fd_log);
	}

	if (shmem_data->recording) {
		// setup and test trans connection
		fd_trans = socket(AF_INET, SOCK_STREAM, 0);
		if (fd_trans < 0)
			error ("0> ERROR creating trans socket", fd_log);
		trans = gethostbyname(trans_host);
		if (trans == NULL)
			error("0> ERROR trans host not found", fd_log);
		bzero((char *) &trans_addr, sizeof(trans_addr));
		trans_addr.sin_family = AF_INET;
		bcopy((char *)trans->h_addr, (char *)&trans_addr.sin_addr.s_addr, trans->h_length);
		trans_addr.sin_port = htons(trans_port);
		n = connect(fd_trans, (struct sockaddr *)&trans_addr, sizeof(trans_addr));
		if (n < 0)
			error("0> ERROR connecting to trans", fd_log);
		// read from trans
		bzero(buffer_out, BUFFERSIZE);
		read(fd_trans, buffer_out, BUFFERSIZE);
		shutdown(fd_trans, 2);
		if (strcmp(buffer_out, "220 Welcome.\n") != 0)
			error ("0> ERROR handshake with trans failed", fd_log);
	}
	
	clientlen = sizeof(client_addr);
	connection_counter = 0;
	while (1) {
		connection_counter++;
		fd_child = accept(fd_parent, (struct sockaddr *) &client_addr, &clientlen);
		if (fd_child < 0) {
			error("0> ERROR on accept", fd_log);
		}

		if (shmem_data->recording) {
			// creating file
			sprintf(file_path, "%s/%s/%i.in.dump", base_path, shmem_data->stage, connection_counter);
			debug(fd_log, connection_counter, "filepath: ");
			debug(fd_log, -1, file_path);
			ensure_file_path(file_path);
			fd_in = fopen(file_path, "w");
			sprintf(file_path, "%s/%s/%i.out.dump", base_path, shmem_data->stage, connection_counter);
			fd_out = fopen(file_path, "w");
			if (fd_in == NULL)
				error("ERROR could not create input log file", fd_log);
			if (fd_out == NULL)
				error("ERROR could not create output log file", fd_log);
		}
		
		hostp = gethostbyaddr((const char *)&client_addr.sin_addr.s_addr, sizeof(client_addr.sin_addr.s_addr), AF_INET);
		if (hostp == NULL){
			error("ERROR on gethostbyaddr", fd_log);
		}
		hostaddrp = inet_ntoa(client_addr.sin_addr);
		if (hostaddrp == NULL){
			error("ERROR on inet_ntoa\n", fd_log);
		}
		debug(fd_log, connection_counter, "server established connection with:");
		debug(fd_log, -1, hostaddrp);
		
		if (shmem_data->recording) {
			// connect to trans
			fd_trans = socket(AF_INET, SOCK_STREAM, 0);
			n = connect(fd_trans, (struct sockaddr *) &trans_addr, sizeof(trans_addr));
			if (n < 0){
				debug(fd_log, connection_counter, "ERROR connecting to trans");
			}
		}

		reading = 1;
		while (reading){
			bzero(buffer_in, BUFFERSIZE);
			n = read(fd_child, buffer_in, BUFFERSIZE);
			if (n == 0){
				debug(fd_log, connection_counter, "end of message");
				reading = 0;
				continue;
			}
			if (n < 0){
				debug(fd_log, connection_counter, "ERROR reading from socket");
				reading = 0;
				continue;
			}
			debug(fd_log, connection_counter, "server received bytes:");

			if (shmem_data->recording){
				write(fd_trans, buffer_in, n);
				fwrite(buffer_in, 1, n, fd_in);
			}
			
			if (is_eom(buffer_in)){
				debug(fd_log, connection_counter, "EOM");
				if (shmem_data->recording){
					// read from trans socket
					bzero(buffer_out, BUFFERSIZE);
					n = read(fd_trans, buffer_out, BUFFERSIZE);
					debug(fd_log, connection_counter, "readed:");
					debug(fd_log, -1, buffer_out);
					while (n > 0){
						debug(fd_log, connection_counter, "writting back:");
						debug(fd_log, -1, buffer_out);
						write(fd_child, buffer_out, n);
						fwrite(buffer_out, 1, n, fd_out);
						bzero(buffer_out, BUFFERSIZE);
						n = read(fd_trans, buffer_out, BUFFERSIZE);
						if (n < 0){
							error("ERROR couldn't read from trans", fd_log);
						}
					}
				} else {
					debug(fd_log, connection_counter, "EOM: retrieving file");
					sprintf(file_path, "%s/%s/%i.out.dump", base_path, shmem_data->stage, connection_counter);
					debug(fd_log, connection_counter, "filepath:");
					debug(fd_log, -1, file_path);
					fd_dump = open(file_path, O_RDONLY);
					if (fd_dump == -1){
						debug(fd_log, connection_counter, "ERROR failed to open file");
						continue;
					}

					fstat(fd_dump, &stat_buf);
					sendfile_offset = 0;
					sendfile(fd_child, fd_dump, &sendfile_offset, stat_buf.st_size);
				}
				reading = 0;
			}
		}
		debug(fd_log, connection_counter, "Closing connection");
		if (shmem_data->recording){
			fclose(fd_in);
			fclose(fd_out);
			close(fd_trans);
		}
		close(fd_child);
		debug(fd_log, -1, "- - - - - - - - - - - - - - - - - - -");
	}
}
