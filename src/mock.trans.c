#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <netdb.h>
#include <fcntl.h>
#include <time.h>
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

void error(char *msg) {
	perror(msg);
	exit(1);
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
		error("ERROR creating shared memmory key");
	}

	if ((shmid = shmget(key, sizeof(struct shared_data), 0644 | IPC_CREAT)) == -1) {
		error("ERROR getting the shared memmory");
	}

	data_ptr = (struct shared_data *)shmat(shmid, (void *)0, 0);
	if (data_ptr == (struct shared_data *)(-1)) {
		error("ERROR attaching to shared memmory segment");
	}

	return data_ptr;
}

void list_config(struct shared_data *data){
	struct tm *timeinfo;
	timeinfo = localtime(&(data->update_time));
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

void set_mode(struct shared_data *data, char value[20]){
	if (strcmp(value, "play") == 0){
		data->recording = 0;
	} else if (strcmp(value, "record") == 0){
		data->recording = 1;
	} else {
		error("ERROR unknown mode");
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
	FILE *fd_in, *fd_out;
	int mock_port, trans_port;

	const char *base_path=getenv("HOME");
	struct shared_data *shmem_data = get_shmem(base_path);

	// arguments list
	// set stage "stage name"
	// set mode [play|record]
	// get config
	// server "port" "trans host" "trans port"
	
	if (argc > 1){
		if (strcmp(argv[1], "server") == 0){
			if (argc == 5){
				mock_port = atoi(argv[2]);
				trans_host = argv[3];
				trans_port = atoi(argv[4]);
				shmem_data->recording = 1;
				printf("0> tunnel: %i:%s:%i\n", mock_port, trans_host, trans_port);
			}
			else if (argc == 3){
				mock_port = atoi(argv[2]);
				shmem_data->recording = 0;
				printf("0> player: %i\n", mock_port);
			}
			else {
				error("ERROR wrong number of parameter for server");
			}
		}
		else if (strcmp(argv[1], "set") == 0){
			if (argc == 4){
				if (strcmp(argv[2], "stage") == 0){
					set_stage(shmem_data, argv[3]);
				} else if (strcmp(argv[2], "mode") == 0){
					set_mode(shmem_data, argv[3]);
				} else {
					error("ERROR unknown variable to set");
				}
			} else {
				error("ERROR wrong number of parameter for set");
			}

			exit (0);
		}
		else if (strcmp(argv[1], "get") == 0){
			if (argc == 3 && strcmp(argv[2], "config") == 0){
				list_config(shmem_data);
			} else {
				error("ERROR unknown param for get");
			}
			exit (0);
		}
		else {
			error("0> ERROR command not found");
		}
	}
	else {
		error("0> ERROR not enough parameters");
	}

	fd_parent = socket(AF_INET, SOCK_STREAM, 0);
	if (fd_parent < 0) {
		error("0> ERROR opening socket");
	}

	setsockopt(fd_parent, SOL_SOCKET, SO_REUSEADDR, (const void *)&optval , sizeof(int));
	bzero((char *) &server_addr, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
	server_addr.sin_port = htons((unsigned short)mock_port);

	if (bind(fd_parent, (struct sockaddr *) &server_addr, sizeof(server_addr)) < 0) {
		error("0> ERROR on binding");
	}
	if (listen(fd_parent, 5) < 0){
		error("0> ERROR on listen");
	}

	if (shmem_data->recording) {
		// setup and test trans connection
		fd_trans = socket(AF_INET, SOCK_STREAM, 0);
		if (fd_trans < 0)
			error ("0> ERROR creating trans socket");
		trans = gethostbyname(trans_host);
		if (trans == NULL)
			error("0> ERROR trans host not found");
		bzero((char *) &trans_addr, sizeof(trans_addr));
		trans_addr.sin_family = AF_INET;
		bcopy((char *)trans->h_addr, (char *)&trans_addr.sin_addr.s_addr, trans->h_length);
		trans_addr.sin_port = htons(trans_port);
		n = connect(fd_trans, (struct sockaddr *)&trans_addr, sizeof(trans_addr));
		if (n < 0)
			error("0> ERROR connecting to trans");
		// read from trans
		bzero(buffer_out, BUFFERSIZE);
		read(fd_trans, buffer_out, BUFFERSIZE);
		shutdown(fd_trans, 2);
		if (strcmp(buffer_out, "220 Welcome.\n") != 0)
			error ("0> ERROR handshake with trans failed");
	}
	
	clientlen = sizeof(client_addr);
	connection_counter = 0;
	while (1) {
		connection_counter++;
		fd_child = accept(fd_parent, (struct sockaddr *) &client_addr, &clientlen);
		if (fd_child < 0) {
			error("0> ERROR on accept");
		}

		if (shmem_data->recording) {
			// creating file
			sprintf(file_path, "%s/%s/%i.in.dump", base_path, shmem_data->stage, connection_counter);
			printf("%i> filepath = %s\n", connection_counter, file_path);
			ensure_file_path(file_path);
			fd_in = fopen(file_path, "w");
			sprintf(file_path, "%s/%s/%i.out.dump", base_path, shmem_data->stage, connection_counter);
			fd_out = fopen(file_path, "w");
			if (fd_in == NULL)
				error("ERROR could not create input log file");
			if (fd_out == NULL)
				error("ERROR could not create output log file");
		}
		
		hostp = gethostbyaddr((const char *)&client_addr.sin_addr.s_addr, sizeof(client_addr.sin_addr.s_addr), AF_INET);
		if (hostp == NULL){
			perror("ERROR on gethostbyaddr");
		}
		hostaddrp = inet_ntoa(client_addr.sin_addr);
		if (hostaddrp == NULL){
			error("ERROR on inet_ntoa\n");
		}
		printf  ("%i> server established connection with %s (%s)\n", connection_counter, hostp->h_name, hostaddrp);
		
		if (shmem_data->recording) {
			// connect to trans
			fd_trans = socket(AF_INET, SOCK_STREAM, 0);
			n = connect(fd_trans, (struct sockaddr *) &trans_addr, sizeof(trans_addr));
			if (n < 0){
				printf("%i> ERROR connecting to trans - %i\n", connection_counter, n);
			}
		}

		reading = 1;
		while (reading){
			bzero(buffer_in, BUFFERSIZE);
			n = read(fd_child, buffer_in, BUFFERSIZE);
			if (n == 0){
				printf("%i> end of message\n", connection_counter);
				reading = 0;
				continue;
			}
			if (n < 0){
				printf("%i> ERROR reading from socket", connection_counter);
				reading = 0;
				continue;
			}
			printf("%i> server received %d bytes:\n", connection_counter, n);

			if (shmem_data->recording){
				write(fd_trans, buffer_in, n);
				fwrite(buffer_in, 1, n, fd_in);
			}
			
			if (is_eom(buffer_in)){
				printf("%i> EOM\n", connection_counter);
				if (shmem_data->recording){
					// read from trans socket
					bzero(buffer_out, BUFFERSIZE);
					n = read(fd_trans, buffer_out, BUFFERSIZE);
					printf("%i> readed %i chars:\n%s\n", connection_counter, n, buffer_out);
					while (n > 0){
						printf("%i> writting back %i chars.\n", connection_counter, n);
						write(fd_child, buffer_out, n);
						fwrite(buffer_out, 1, n, fd_out);
						bzero(buffer_out, BUFFERSIZE);
						n = read(fd_trans, buffer_out, BUFFERSIZE);
						if (n < 0)
							perror("ERROR couldn't read from trans");
					}
				} else {
					printf ("%i> EOM: retrieving file\n", connection_counter);
					sprintf(file_path, "%s/%s/%i.out.dump", base_path, shmem_data->stage, connection_counter);
					printf("%i> filepath = %s\n", connection_counter, file_path);
					fd_dump = open(file_path, O_RDONLY);
					if (fd_dump == -1){
						printf("%i> ERROR failed to open file\n", connection_counter);
						continue;
					}

					fstat(fd_dump, &stat_buf);
					sendfile_offset = 0;
					sendfile(fd_child, fd_dump, &sendfile_offset, stat_buf.st_size);
				}
				reading = 0;
			}
		}
		printf("%i> Closing connection\n", connection_counter);
		if (shmem_data->recording){
			fclose(fd_in);
			fclose(fd_out);
			close(fd_trans);
		}
		close(fd_child);
		printf("- - - - - - - - - - - - - - - - - - - - - - - - - - -\n");
	}
}
