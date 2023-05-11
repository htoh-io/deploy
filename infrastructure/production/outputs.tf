# output "public_ip" {
#   value = scaleway_instance_ip.public_ip.address
# }

output "private_instance" {
    value = scaleway_instance_server.web
}

output "private_instance_network" {
    value = scaleway_instance_private_nic.web_dmz
}

output "private_ip" {
    value = data.scaleway_vpc_public_gateway_dhcp_reservation.by_mac_address
}